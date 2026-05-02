import re
import json
import requests
from typing import Generator, Tuple
from app.core.config import settings

# ---------------------------------------------------------------------------
# System prompt cố định — gửi qua system role của Chat API
# ---------------------------------------------------------------------------
VIETNAMESE_SYSTEM_PROMPT = (
    "Bạn là trợ lý AI nội bộ chuyên phân tích tài liệu. "
    "Bạn PHẢI trả lời HOÀN TOÀN bằng TIẾNG VIỆT trong mọi tình huống, mọi câu, mọi từ. "
    "Tuyệt đối không được dùng tiếng Anh dù chỉ một từ đơn lẻ. "
    "Kể cả các từ kết luận hay chuyển tiếp đều phải bằng tiếng Việt. "
    "QUAN TRỌNG về ngôi xưng hô: Luôn xưng 'tôi' (trợ lý) và gọi người dùng là 'bạn'. "
    "TUYỆT ĐỐI không lặp lại xưng hô của người dùng vào câu trả lời — "
    "ví dụ nếu họ nói 'Tôi là nhân viên...' thì trả lời bằng 'Với tư cách nhân viên, bạn được...' "
    "hoặc 'Nhân viên được hưởng...' — KHÔNG được viết 'Tôi là nhân viên...'."
)

_OLLAMA_CHAT_URL = None

def _chat_url() -> str:
    global _OLLAMA_CHAT_URL
    if _OLLAMA_CHAT_URL is None:
        _OLLAMA_CHAT_URL = f"{settings.OLLAMA_BASE_URL}/api/chat"
    return _OLLAMA_CHAT_URL

def _base_options() -> dict:
    return {
        "temperature": settings.LLM_TEMPERATURE,
        "num_predict": settings.LLM_NUM_PREDICT,
        "num_ctx": settings.LLM_NUM_CTX,
    }

def _messages(user_content: str) -> list:
    wrapped = (
        "LỆNH BẮT BUỘC: Viết toàn bộ câu trả lời bằng TIẾNG VIỆT, không dùng bất kỳ từ tiếng Anh nào.\n\n"
        + user_content
        + "\n\n(Nhắc lại: câu trả lời phải hoàn toàn bằng tiếng Việt.)"
    )
    return [
        {"role": "system", "content": VIETNAMESE_SYSTEM_PROMPT},
        {"role": "user", "content": wrapped},
    ]


def safe_llm_invoke(user_content: str) -> str:
    """Gọi Ollama HTTP API (non-stream). Trả về toàn bộ câu trả lời dạng string."""
    payload = {
        "model": settings.LLM_MODEL_NAME,
        "messages": _messages(user_content),
        "stream": False,
        "options": _base_options(),
    }
    try:
        resp = requests.post(_chat_url(), json=payload, timeout=120)
        resp.raise_for_status()
        content = resp.json().get("message", {}).get("content", "")
        if not content:
            print("[LLM WARNING] response.content rỗng hoặc None.")
        return content
    except Exception as e:
        print(f"[LLM ERROR] safe_llm_invoke thất bại: {e}")
        raise


def stream_llm_invoke(user_content: str) -> Generator[str, None, None]:
    """Gọi Ollama HTTP API (stream=True). Yield từng token khi LLM sinh ra."""
    payload = {
        "model": settings.LLM_MODEL_NAME,
        "messages": _messages(user_content),
        "stream": True,
        "options": _base_options(),
    }
    try:
        with requests.post(_chat_url(), json=payload, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                try:
                    chunk = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
    except Exception as e:
        print(f"[LLM ERROR] stream_llm_invoke thất bại: {e}")
        raise


def apply_pii_masking(text: str) -> str:
    """Che số điện thoại và email trong output trước khi trả về user."""
    masked = re.sub(r'\b\d{10}\b', '[SỐ ĐIỆN THOẠI ĐÃ ẨN]', text)
    masked = re.sub(r'[\w\.-]+@[\w\.-]+', '[EMAIL ĐÃ ẨN]', masked)
    return masked


def check_hallucination(context: str, query: str = "") -> bool:  # noqa: ARG001
    """Anti-hallucination: trả về True nếu context rỗng."""
    if not context or context.strip() == "":
        return True
    return False


def stream_llm_invoke_with_thinking(user_content: str) -> Generator[Tuple[str, str], None, None]:
    """
    Gọi thinking model qua Ollama HTTP API với think=true.
    Yield tuple (kind, token): ("thinking", token) hoặc ("answer", token).
    Fallback về stream_llm_invoke nếu thinking model không available.
    """
    payload = {
        "model": settings.THINKING_MODEL_NAME,
        "messages": _messages(user_content),
        "stream": True,
        "think": True,
        "options": _base_options(),
    }
    try:
        with requests.post(_chat_url(), json=payload, stream=True, timeout=120) as resp:
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
        print(f"[Thinking] Không kết nối được {settings.THINKING_MODEL_NAME}, fallback về {settings.LLM_MODEL_NAME}")
        for token in stream_llm_invoke(user_content):
            yield ("answer", token)
    except requests.exceptions.HTTPError as e:
        print(f"[Thinking] HTTP lỗi ({e}), fallback về model thường")
        for token in stream_llm_invoke(user_content):
            yield ("answer", token)


def log_english_leakage(response: str) -> None:
    """Log warning nếu phát hiện tiếng Anh rò rỉ trong câu trả lời."""
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
