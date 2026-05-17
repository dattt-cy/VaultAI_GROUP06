"""
Admin RAG Config Routes – /api/admin/rag-config
Quản lý cấu hình RAG: chunking, embedding, retrieval.
Lưu vào bảng `rag_config` trong DB, fallback về settings mặc định.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.api.dependencies import require_min_level
from app.core.config import settings

router = APIRouter()

# Default values from config
DEFAULTS = {
    "parent_chunk_size": str(settings.PARENT_CHUNK_SIZE),
    "parent_chunk_overlap": str(settings.PARENT_CHUNK_OVERLAP),
    "child_chunk_size": str(settings.CHILD_CHUNK_SIZE),
    "child_chunk_overlap": str(settings.CHILD_CHUNK_OVERLAP),
    "embedding_model": settings.EMBEDDING_MODEL_NAME,
    "reranker_model": settings.RERANKER_MODEL_NAME,
    "top_k_retrieval": "10",
    "hybrid_search_alpha": "0.5",
}


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS rag_config (
            `key` VARCHAR(100) PRIMARY KEY,
            `value` TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """))
    db.commit()


def _get_all(db: Session) -> dict:
    _ensure_table(db)
    rows = db.execute(text("SELECT `key`, `value` FROM rag_config")).fetchall()
    stored = {r[0]: r[1] for r in rows}
    result = {}
    for k, default in DEFAULTS.items():
        result[k] = stored.get(k, default)
    return result


def _set_key(db: Session, key: str, value: str):
    db.execute(text("""
        INSERT INTO rag_config (`key`, `value`) VALUES (:k, :v)
        ON DUPLICATE KEY UPDATE `value` = :v, updated_at = NOW()
    """), {"k": key, "v": value})
    db.commit()


class RAGConfigUpdate(BaseModel):
    parent_chunk_size: Optional[int] = None
    parent_chunk_overlap: Optional[int] = None
    child_chunk_size: Optional[int] = None
    child_chunk_overlap: Optional[int] = None
    embedding_model: Optional[str] = None
    reranker_model: Optional[str] = None
    top_k_retrieval: Optional[int] = None
    hybrid_search_alpha: Optional[float] = None


# ─────────────────────────────────────────────
# GET /rag-config
# ─────────────────────────────────────────────
@router.get("/rag-config", summary="Lấy cấu hình RAG", dependencies=[Depends(require_min_level(9))])
def get_rag_config(db: Session = Depends(get_db)):
    cfg = _get_all(db)
    return {
        "parent_chunk_size": int(cfg["parent_chunk_size"]),
        "parent_chunk_overlap": int(cfg["parent_chunk_overlap"]),
        "child_chunk_size": int(cfg["child_chunk_size"]),
        "child_chunk_overlap": int(cfg["child_chunk_overlap"]),
        "embedding_model": cfg["embedding_model"],
        "reranker_model": cfg["reranker_model"],
        "top_k_retrieval": int(cfg["top_k_retrieval"]),
        "hybrid_search_alpha": float(cfg["hybrid_search_alpha"]),
    }


# ─────────────────────────────────────────────
# PUT /rag-config
# ─────────────────────────────────────────────
@router.put("/rag-config", summary="Cập nhật cấu hình RAG", dependencies=[Depends(require_min_level(9))])
def update_rag_config(body: RAGConfigUpdate, db: Session = Depends(get_db)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Không có thay đổi nào.")

    for k, v in updates.items():
        _set_key(db, k, str(v))

    return {"message": "Cấu hình RAG đã được cập nhật.", "updated": list(updates.keys())}
