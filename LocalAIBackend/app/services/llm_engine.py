import re
import json
import requests
from typing import Generator, Tuple
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



def stream_llm_invoke(user_content: str) -> Generator[str, None, None]:
    """
    Gọi ChatOllama với streaming — yield từng token khi LLM sinh ra.
    Interface: nhận str, yield str (từng token).
    """
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
        for chunk in get_llm().stream(messages):
            if chunk.content:
                yield chunk.content
    except Exception as e:
        err_str = str(e).lower()
        if "connection" in err_str or "refused" in err_str or "timeout" in err_str:
            reset_llm_instance()
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


def stream_llm_invoke_with_thinking(user_content: str) -> Generator[Tuple[str, str], None, None]:
    """
    Gọi thinking model (qwen3:8b) qua Ollama HTTP API với think=true.
    Yield tuple (kind, token):
      ("thinking", token) — token thuộc phần suy luận nội tâm
      ("answer", token)   — token thuộc phần câu trả lời thực sự
    Fallback về stream_llm_invoke nếu thinking model không available.
    """
    wrapped = (
        "LỆNH BẮT BUỘC: Viết toàn bộ câu trả lời bằng TIẾNG VIỆT, không dùng bất kỳ từ tiếng Anh nào.\n\n"
        + user_content
        + "\n\n(Nhắc lại: câu trả lời phải hoàn toàn bằng tiếng Việt.)"
    )
    payload = {
        "model": settings.THINKING_MODEL_NAME,
        "messages": [
            {"role": "system", "content": VIETNAMESE_SYSTEM_PROMPT},
            {"role": "user", "content": wrapped},
        ],
        "stream": True,
        "think": True,
        "options": {
            "temperature": settings.LLM_TEMPERATURE,
            "num_predict": settings.LLM_NUM_PREDICT,
            "num_ctx": settings.LLM_NUM_CTX,
        },
    }
    try:
        with requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json=payload,
            stream=True,
            timeout=120,
        ) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                try:
                    chunk = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                msg = chunk.get("message", {})
                thinking_token = msg.get("thinking", "")
                answer_token = msg.get("content", "")
                if thinking_token:
                    yield ("thinking", thinking_token)
                if answer_token:
                    yield ("answer", answer_token)
    except requests.exceptions.ConnectionError:
        # Ollama không chạy hoặc model chưa pull — fallback sang model thường
        print(f"[Thinking] Không kết nối được {settings.THINKING_MODEL_NAME}, fallback về {settings.LLM_MODEL_NAME}")
        for token in stream_llm_invoke(user_content):
            yield ("answer", token)
    except requests.exceptions.HTTPError as e:
        print(f"[Thinking] HTTP lỗi ({e}), fallback về model thường")
        for token in stream_llm_invoke(user_content):
            yield ("answer", token)


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
