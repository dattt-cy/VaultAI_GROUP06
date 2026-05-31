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
    "hoặc 'Nhân viên được hưởng...' — KHÔNG được viết 'Tôi là nhân viên...'. "
    "LUÔN trả lời ĐẦY ĐỦ dù câu hỏi đã từng được hỏi trước đó trong hội thoại. "
    "KHÔNG rút ngắn, KHÔNG viết 'như đã đề cập', KHÔNG bỏ bớt chi tiết vì đã trình bày ở lượt trước."
)

_OLLAMA_CHAT_URL = None

def _chat_url() -> str:
    global _OLLAMA_CHAT_URL
    if _OLLAMA_CHAT_URL is None:
        _OLLAMA_CHAT_URL = f"{settings.OLLAMA_BASE_URL}/api/chat"
    return _OLLAMA_CHAT_URL

def _base_options(options_override: dict = None) -> dict:
    base = {
        "temperature": settings.LLM_TEMPERATURE,
        "num_predict": settings.LLM_NUM_PREDICT,
        "num_ctx": settings.LLM_NUM_CTX,
        "num_gpu": settings.LLM_NUM_GPU,
        "num_batch": settings.LLM_NUM_BATCH,
    }
    if options_override:
        base.update(options_override)
    return base

def _messages(user_content: str, system_prompt: str = None) -> list:
    sys = system_prompt if system_prompt else VIETNAMESE_SYSTEM_PROMPT
    wrapped = user_content
    return [
        {"role": "system", "content": sys},
        {"role": "user", "content": wrapped},
    ]


# ---------------------------------------------------------------------------
# Token budget — tiếng Việt trung bình ~3 ký tự/token (có dấu)
# ---------------------------------------------------------------------------
_CHARS_PER_TOKEN = 3

def estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


def trim_to_token_budget(text: str, max_tokens: int) -> str:
    """Cắt text để vừa trong max_tokens (ước tính)."""
    max_chars = max_tokens * _CHARS_PER_TOKEN
    if len(text) <= max_chars:
        return text
    # Cắt ở ranh giới câu gần nhất
    truncated = text[:max_chars]
    last_break = max(truncated.rfind('\n'), truncated.rfind('. '))
    if last_break > max_chars // 2:
        truncated = truncated[:last_break + 1]
    print(f"[TokenBudget] Context trimmed: {len(text)} → {len(truncated)} chars")
    return truncated


def safe_llm_invoke(user_content: str, system_prompt: str = None, options_override: dict = None) -> str:
    """Gọi Ollama HTTP API (non-stream). Trả về toàn bộ câu trả lời dạng string."""
    payload = {
        "model": settings.LLM_MODEL_NAME,
        "messages": _messages(user_content, system_prompt),
        "stream": False,
        "options": _base_options(options_override),
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


def fast_llm_invoke(user_content: str, num_predict: int = 120, system_prompt: str = None) -> str:
    """Gọi Ollama với num_predict thấp — dùng cho tác vụ ngắn như sinh suggestions."""
    options = _base_options()
    options["num_predict"] = num_predict
    payload = {
        "model": settings.LLM_MODEL_NAME,
        "messages": _messages(user_content, system_prompt),
        "stream": False,
        "options": options,
    }
    try:
        resp = requests.post(_chat_url(), json=payload, timeout=45)
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "")
    except Exception as e:
        print(f"[LLM ERROR] fast_llm_invoke thất bại: {e}")
        raise


def stream_llm_invoke(user_content: str, system_prompt: str = None, options_override: dict = None) -> Generator[str, None, None]:
    """Gọi Ollama HTTP API (stream=True). Yield từng token khi LLM sinh ra."""
    payload = {
        "model": settings.LLM_MODEL_NAME,
        "messages": _messages(user_content, system_prompt),
        "stream": True,
        "options": _base_options(options_override),
    }
    print(f"[LLM DEBUG] prompt length: {len(user_content)} chars")
    try:
        with requests.post(_chat_url(), json=payload, stream=True, timeout=120) as resp:
            if not resp.ok:
                print(f"[LLM ERROR] HTTP {resp.status_code}: {resp.text[:500]}")
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


def check_hallucination(context: str, query: str = "") -> bool:
    """
    Anti-hallucination: trả về True nếu context không liên quan đến query.
    Dùng keyword overlap đơn giản — nhanh, không tốn LLM call.
    """
    if not context or context.strip() == "":
        return True
    if not query or not query.strip():
        return False

    # Tách token có nghĩa (bỏ stopword ngắn)
    stopwords = {"là", "có", "và", "của", "trong", "với", "các", "được", "cho",
                 "về", "này", "đó", "không", "hay", "hoặc", "thì", "để", "khi",
                 "bị", "do", "từ", "tại", "theo", "như", "cũng", "vì", "nên"}
    query_tokens = {
        t.lower() for t in re.findall(r'\w+', query)
        if len(t) > 2 and t.lower() not in stopwords
    }
    if not query_tokens:
        return False

    context_lower = context.lower()
    matched = sum(1 for t in query_tokens if t in context_lower)
    overlap_ratio = matched / len(query_tokens)

    # Nếu < 20% keyword của query xuất hiện trong context → không liên quan
    if overlap_ratio < 0.2:
        print(f"[Hallucination] Query-context overlap thấp: {overlap_ratio:.0%} ({matched}/{len(query_tokens)} keywords)")
        return True
    return False


def check_response_grounding(response: str, chunks: list, threshold: float = -5.0) -> bool:
    """
    Kiểm tra sau khi generate: có ít nhất 1 câu trong response được grounded
    vào retrieved chunks không (cross-encoder score >= threshold).

    Trả về True nếu response có vẻ hallucinated (không có câu nào grounded).
    Chỉ gọi khi reranker đã được load (tránh cold-start penalty).
    threshold mặc định -5.0 rộng hơn citation threshold (-1.5) vì chỉ cần
    xác nhận có liên quan, không cần exact match.
    """
    if not response or not chunks:
        return False
    try:
        from app.services.hybrid_retriever import get_reranker
        reranker = get_reranker()
        if not reranker:
            return False
    except Exception:
        return False

    # Lấy tối đa 5 câu đầu tiên từ response để kiểm tra nhanh
    sentences = [
        s.strip() for s in re.split(r'(?<=[.!?\n])\s+', response)
        if len(s.strip()) > 20
    ][:5]
    if not sentences:
        return False

    # Score mỗi câu với top 6 chunks — dùng 3 trước đây dễ miss chunk liên quan ở vị trí 4-5
    top_chunks = chunks[:6]
    pairs = [[sent, chunk.content] for sent in sentences for chunk in top_chunks]
    try:
        scores = reranker.predict(pairs)
        score_list = scores.tolist() if hasattr(scores, 'tolist') else list(scores)
        best_score = max(score_list)
        if best_score < threshold:
            print(f"[Grounding] Response có thể hallucinated — best_score={best_score:.3f} < {threshold}")
            return True
    except Exception as e:
        print(f"[Grounding ERROR] {e}")
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
