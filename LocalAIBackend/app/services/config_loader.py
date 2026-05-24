"""
Cached loader cho SystemPrompt và LlmConfig từ DB.
TTL 60s — giảm DB hit mà vẫn phản ánh thay đổi của admin trong vòng 1 phút.
"""
import time
from sqlalchemy.orm import Session
from app.models.sys_model import SystemPrompt, LlmConfig
from app.core.config import settings

_TTL = 60.0  # giây

# Cache SystemPrompt
_system_prompt_cache: str | None = None
_system_prompt_at: float = 0.0

# Cache LlmConfig options
_llm_options_cache: dict | None = None
_llm_options_at: float = 0.0


def get_active_system_prompt(db: Session) -> str:
    """
    Trả về nội dung SystemPrompt đang active từ DB (cache 60s).
    Fallback về VIETNAMESE_SYSTEM_PROMPT mặc định nếu không có bản ghi active.
    """
    global _system_prompt_cache, _system_prompt_at
    now = time.monotonic()
    if _system_prompt_cache is not None and (now - _system_prompt_at) < _TTL:
        return _system_prompt_cache

    try:
        row = (
            db.query(SystemPrompt)
            .filter(SystemPrompt.is_active == True)
            .order_by(SystemPrompt.id.desc())
            .first()
        )
        if row and row.prompt_content and row.prompt_content.strip():
            _system_prompt_cache = row.prompt_content.strip()
            _system_prompt_at = now
            return _system_prompt_cache
    except Exception as e:
        print(f"[ConfigLoader] Không đọc được SystemPrompt từ DB: {e}")

    # Fallback — import tránh circular
    from app.services.llm_engine import VIETNAMESE_SYSTEM_PROMPT
    _system_prompt_cache = VIETNAMESE_SYSTEM_PROMPT
    _system_prompt_at = now
    return _system_prompt_cache


def get_active_llm_options(db: Session) -> dict:
    """
    Trả về Ollama options từ LlmConfig active (cache 60s).
    Fallback về settings mặc định nếu không có bản ghi active.
    """
    global _llm_options_cache, _llm_options_at
    now = time.monotonic()
    if _llm_options_cache is not None and (now - _llm_options_at) < _TTL:
        return _llm_options_cache

    default = {
        "temperature": settings.LLM_TEMPERATURE,
        "num_predict": settings.LLM_NUM_PREDICT,
        "num_ctx": settings.LLM_NUM_CTX,
        "num_gpu": settings.LLM_NUM_GPU,
        "num_batch": settings.LLM_NUM_BATCH,
    }

    try:
        row = (
            db.query(LlmConfig)
            .filter(LlmConfig.is_active == True)
            .order_by(LlmConfig.id.desc())
            .first()
        )
        if row:
            opts = dict(default)
            if row.temperature is not None:
                opts["temperature"] = float(row.temperature)
            if row.max_new_tokens is not None:
                opts["num_predict"] = int(row.max_new_tokens)
            if row.context_window_limit is not None:
                opts["num_ctx"] = int(row.context_window_limit)
            _llm_options_cache = opts
            _llm_options_at = now
            return _llm_options_cache
    except Exception as e:
        print(f"[ConfigLoader] Không đọc được LlmConfig từ DB: {e}")

    _llm_options_cache = default
    _llm_options_at = now
    return _llm_options_cache


def invalidate_cache() -> None:
    """Gọi khi admin thay đổi SystemPrompt/LlmConfig để xóa cache ngay."""
    global _system_prompt_at, _llm_options_at
    _system_prompt_at = 0.0
    _llm_options_at = 0.0
