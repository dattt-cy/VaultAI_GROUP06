"""Admin – System, Documents, Chroma, AI Config, System Prompts, Audit Logs."""
import json as _json
from typing import Optional

import psutil
import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.chat_model import ChatSession, Feedback, Message
from app.models.doc_model import Document, DocumentPage
from app.models.sys_model import AuditLog, LlmConfig, SystemPrompt
from app.models.user_model import User
from app.services.config_loader import invalidate_cache as _invalidate_config_cache
from app.services.vector_store import get_vector_store

router = APIRouter()


# ─────────────────────────────────────────────
# Overview
# ─────────────────────────────────────────────
@router.get("/overview", summary="Tổng quan hệ thống")
def overview(db: Session = Depends(get_db)):
    ingestion_stats = {
        s: db.query(Document).filter(Document.ingestion_status == s).count()
        for s in ("COMPLETED", "PROCESSING", "PENDING", "FAILED")
    }

    try:
        vs = get_vector_store()
        chroma_count = vs._collection.count()
        chroma_status = "connected"
    except Exception as e:
        chroma_count = -1
        chroma_status = f"error: {e}"

    total_feedback = db.query(Feedback).count()
    feedback_stats = {
        "total": total_feedback,
        "pending": db.query(Feedback).filter(
            Feedback.reaction.in_(["DISLIKE", "HALLUCINATED"]),
            Feedback.resolved == False,  # noqa: E712
        ).count(),
        "likes": db.query(Feedback).filter(Feedback.reaction == "LIKE").count(),
        "dislikes": db.query(Feedback).filter(Feedback.reaction == "DISLIKE").count(),
        "hallucinated": db.query(Feedback).filter(Feedback.reaction == "HALLUCINATED").count(),
    }

    return {
        "total_users": db.query(User).count(),
        "total_documents": db.query(Document).count(),
        "total_sessions": db.query(ChatSession).count(),
        "total_messages": db.query(Message).count(),
        "ingestion_stats": ingestion_stats,
        "chroma_status": chroma_status,
        "chroma_vectors": chroma_count,
        "feedback_stats": feedback_stats,
    }


# ─────────────────────────────────────────────
# Documents (admin read-only view)
# ─────────────────────────────────────────────
@router.get("/documents", summary="Danh sách tài liệu")
def list_documents(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    docs = db.query(Document).offset(skip).limit(limit).all()
    result = []
    for d in docs:
        chunk_count = db.query(DocumentPage).filter_by(document_id=d.id).count()
        result.append({
            "id": d.id,
            "title": d.title,
            "file_type": d.file_type,
            "file_size_bytes": d.file_size_bytes,
            "total_tokens": d.total_tokens,
            "ingestion_status": d.ingestion_status,
            "scope": d.document_scope,
            "document_scope": d.document_scope,
            "category_id": d.category_id,
            "category_name": d.category.name if d.category else None,
            "chunk_count": chunk_count,
            "created_at": str(d.created_at),
            "error_message": d.error_message,
        })
    return {"total": len(result), "items": result}


@router.get("/documents/{document_id}/chunks", summary="Chunks của tài liệu")
def list_chunks(document_id: int, db: Session = Depends(get_db)):
    pages = (
        db.query(DocumentPage)
        .filter_by(document_id=document_id)
        .order_by(DocumentPage.chunk_index)
        .all()
    )
    return {
        "document_id": document_id,
        "total_chunks": len(pages),
        "chunks": [
            {
                "id": p.id,
                "chunk_index": p.chunk_index,
                "token_count": p.token_count,
                "vector_id": p.vector_id,
                "content_preview": p.raw_content[:200],
            }
            for p in pages
        ],
    }


# ─────────────────────────────────────────────
# ChromaDB
# ─────────────────────────────────────────────
@router.get("/chroma/vectors", summary="Xem các Vector đã lưu trong ChromaDB")
def chroma_vectors(limit: int = 20):
    try:
        vs = get_vector_store()
        collection = vs._collection
        data = collection.get(limit=limit, include=["documents", "metadatas"])
        items = [
            {
                "vector_id": vid,
                "metadata": data["metadatas"][i] if data["metadatas"] else {},
                "content_preview": (data["documents"][i][:200] if data["documents"] else ""),
            }
            for i, vid in enumerate(data["ids"])
        ]
        return {"total_in_collection": collection.count(), "items": items}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# System Metrics
# ─────────────────────────────────────────────
@router.get("/system/metrics", summary="Tài nguyên hệ thống")
def system_metrics():
    cpu_percent = psutil.cpu_percent(interval=0.2)
    vm = psutil.virtual_memory()

    vram_used_mb = vram_total_mb = 0
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3,
        )
        if result.returncode == 0:
            used_str, total_str = result.stdout.strip().split(",")
            vram_used_mb = int(used_str.strip())
            vram_total_mb = int(total_str.strip())
    except Exception:
        pass

    ollama_online = False
    try:
        resp = http_requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2)
        ollama_online = resp.status_code == 200
    except Exception:
        pass

    return {
        "cpu_percent": cpu_percent,
        "ram_used_mb": vm.used // (1024 * 1024),
        "ram_total_mb": vm.total // (1024 * 1024),
        "vram_used_mb": vram_used_mb,
        "vram_total_mb": vram_total_mb,
        "ollama": {
            "url": settings.OLLAMA_BASE_URL,
            "model": settings.LLM_MODEL_NAME,
            "online": ollama_online,
        },
    }


# ─────────────────────────────────────────────
# AI Config
# ─────────────────────────────────────────────
class LlmConfigUpdateRequest(BaseModel):
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    context_window_limit: Optional[int] = None
    max_new_tokens: Optional[int] = None


@router.get("/ai-config", summary="Đọc cấu hình LLM hiện tại")
def get_ai_config(db: Session = Depends(get_db)):
    cfg = db.query(LlmConfig).filter(LlmConfig.is_active == True).first()
    if not cfg:
        return {"active": False}
    return {
        "id": cfg.id,
        "model_name": cfg.model_name,
        "temperature": cfg.temperature,
        "context_window_limit": cfg.context_window_limit,
        "max_new_tokens": cfg.max_new_tokens,
        "is_active": cfg.is_active,
        "updated_at": str(cfg.updated_at),
    }


@router.put("/ai-config", summary="Lưu cấu hình LLM")
def update_ai_config(body: LlmConfigUpdateRequest, db: Session = Depends(get_db)):
    cfg = db.query(LlmConfig).filter(LlmConfig.is_active == True).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Chưa có cấu hình LLM")
    if body.model_name is not None:
        cfg.model_name = body.model_name
    if body.temperature is not None:
        cfg.temperature = body.temperature
    if body.context_window_limit is not None:
        cfg.context_window_limit = body.context_window_limit
    if body.max_new_tokens is not None:
        cfg.max_new_tokens = body.max_new_tokens
    db.commit()
    _invalidate_config_cache()
    return {"ok": True}


@router.post("/ai-config/test-connection", summary="Kiểm tra kết nối Ollama")
def test_ollama_connection():
    try:
        resp = http_requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            return {"online": True, "url": settings.OLLAMA_BASE_URL}
        return {"online": False, "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"online": False, "detail": str(e)}


# ─────────────────────────────────────────────
# System Prompts
# ─────────────────────────────────────────────
class SystemPromptUpdateRequest(BaseModel):
    prompt_content: str


@router.get("/system-prompts", summary="Danh sách system prompts")
def list_system_prompts(db: Session = Depends(get_db)):
    prompts = db.query(SystemPrompt).order_by(SystemPrompt.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "version_name": p.version_name,
            "description": p.description,
            "prompt_content": p.prompt_content,
            "is_active": p.is_active,
            "created_at": str(p.created_at),
        }
        for p in prompts
    ]


@router.put("/system-prompts/{prompt_id}", summary="Cập nhật nội dung system prompt")
def update_system_prompt(prompt_id: int, body: SystemPromptUpdateRequest, db: Session = Depends(get_db)):
    prompt = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt không tồn tại")
    prompt.prompt_content = body.prompt_content
    db.commit()
    _invalidate_config_cache()
    return {"ok": True}


@router.post("/system-prompts/{prompt_id}/activate", summary="Kích hoạt system prompt")
def activate_system_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt không tồn tại")
    db.query(SystemPrompt).update({"is_active": False})
    prompt.is_active = True
    db.commit()
    _invalidate_config_cache()
    return {"ok": True}


# ─────────────────────────────────────────────
# Audit Logs
# ─────────────────────────────────────────────
@router.get("/audit-logs", summary="Nhật ký hoạt động hệ thống")
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action: Optional[str] = None,
    username: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.filter(AuditLog.action == action)
    if username:
        q = q.filter(AuditLog.username.ilike(f"%{username}%"))
    total = q.count()
    logs = q.offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "username": log.username,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "details": _json.loads(log.details_json) if log.details_json else None,
                "ip_address": log.ip_address,
                "created_at": str(log.created_at),
            }
            for log in logs
        ],
    }
