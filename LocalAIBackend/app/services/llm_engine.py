import re
from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.config import settings

# ---------------------------------------------------------------------------
# System prompt cố định — gửi qua system role của Chat API
# Đây là tầng bảo vệ ngôn ngữ chính, độc lập với nội dung prompt user
# ---------------------------------------------------------------------------
VIETNAMESE_SYSTEM_PROMPT = (
    "Bạn là trợ lý AI nội bộ chuyên phân tích tài liệu. "
    "Bạn PHẢI trả lời HOÀN TOÀN bằng TIẾNG VIỆT trong mọi tình huống, mọi câu, mọi từ. "
    "Tuyệt đối không được dùng tiếng Anh dù chỉ một từ đơn lẻ. "
    "Kể cả các từ kết luận hay chuyển tiếp đều phải bằng tiếng Việt."
)

# Singleton — tránh tạo mới object mỗi request
_llm_instance = None


def get_llm() -> ChatOllama:
    """
    Trả về singleton ChatOllama.
    Tự reset nếu phát hiện Ollama bị restart (ConnectionError).
    """
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = _create_llm()
    return _llm_instance


def _create_llm() -> ChatOllama:
    return ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.LLM_MODEL_NAME,
        temperature=settings.LLM_TEMPERATURE,   # 0.3 — bám sát context
        top_p=0.9,
        num_predict=settings.LLM_NUM_PREDICT,   # 1024 — đủ dài
        num_ctx=settings.LLM_NUM_CTX,           # 4096 — đủ chứa 5 chunks
    )


def reset_llm_instance():
    """Gọi khi phát hiện Ollama bị restart. Lần invoke tiếp sẽ tạo lại connection."""
    global _llm_instance
    _llm_instance = None


def safe_llm_invoke(user_content: str) -> str:
    """
    Gọi ChatOllama với system role tiếng Việt + sandwich pattern trong user message.
    Sandwich pattern: nhắc tiếng Việt ở ĐẦU và CUỐI user message để llama3:8b không bỏ qua.
    Interface giữ nguyên: nhận str, trả str.
    Tự động retry 1 lần nếu gặp ConnectionError (Ollama restart).
    """
    # Sandwich pattern — bắt buộc với llama3:8b vì model này bỏ qua system role
    wrapped = (
        "LỆNH BẮT BUỘC: Viết toàn bộ câu trả lời bằng TIẾNG VIỆT, không dùng bất kỳ từ tiếng Anh nào.\n\n"
        + user_content
        + "\n\n(Nhắc lại: câu trả lời phải hoàn toàn bằng tiếng Việt.)"
    )
    messages = [
        SystemMessage(content=VIETNAMESE_SYSTEM_PROMPT),
        HumanMessage(content=wrapped),
    ]
    try:
        response = get_llm().invoke(messages)
        content = response.content if response.content is not None else ""
        if not content:
            print("[LLM WARNING] response.content rỗng hoặc None.")
        return content
    except Exception as e:
        err_str = str(e).lower()
        if "connection" in err_str or "refused" in err_str or "timeout" in err_str:
            print(f"[LLM] Connection lỗi, reset singleton và thử lại: {e}")
            reset_llm_instance()
            try:
                response = get_llm().invoke(messages)
                return response.content if response.content is not None else ""
            except Exception as retry_err:
                print(f"[LLM ERROR] Retry cũng thất bại: {retry_err}")
                raise
        raise



def apply_pii_masking(text: str) -> str:
    """Che số điện thoại và email trong output trước khi trả về user."""
    # Số điện thoại Việt Nam 10 chữ số
    masked = re.sub(r'\b\d{10}\b', '[SỐ ĐIỆN THOẠI ĐÃ ẨN]', text)
    # Email
    masked = re.sub(r'[\w\.-]+@[\w\.-]+', '[EMAIL ĐÃ ẨN]', masked)
    return masked


def check_hallucination(context: str, query: str) -> bool:
    """
    Anti-hallucination: trả về True nếu context rỗng.
    """
    if not context or context.strip() == "":
        return True
    return False


def log_english_leakage(response: str) -> None:
    """
    Log warning nếu phát hiện tiếng Anh rò rỉ trong câu trả lời.
    Không sửa output — chỉ để monitor.
    """
    english_patterns = [
        r'\bTherefore\b', r'\bIn conclusion\b', r'\bBased on\b',
        r'\bHowever\b', r'\bFurthermore\b', r'\bIn summary\b',
        r'\bNote that\b', r'\bPlease note\b', r'\bAccording to\b',
        r"\bI'd be happy\b", r'\bI can provide\b', r'\bIt seems\b',
    ]
    for pattern in english_patterns:
        if re.search(pattern, response, re.IGNORECASE):
            print(f"[LLM WARNING] Phát hiện tiếng Anh rò rỉ — pattern: '{pattern}'")
            break
