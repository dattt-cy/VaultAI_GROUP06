"""
Admin Router – /api/admin/*
Cung cấp giao diện JSON để kiểm tra trạng thái SQLite & ChromaDB.
Không yêu cầu xác thực (chỉ dùng nội bộ / dev).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect

from app.db.session import get_db
from app.models.doc_model import Document, DocumentPage, Category
from app.models.user_model import User, Role
from app.models.chat_model import ChatSession, Message
from app.services.vector_store import get_vector_store

router = APIRouter()


# ─────────────────────────────────────────────
# 1. Tổng quan toàn bộ hệ thống
# ─────────────────────────────────────────────
@router.get("/overview", summary="Tổng quan Database")
def overview(db: Session = Depends(get_db)):
    """Trả về số lượng bản ghi của mọi bảng SQLite & trạng thái ChromaDB."""
    sqlite_stats = {
        "roles":           db.query(Role).count(),
        "users":           db.query(User).count(),
        "categories":      db.query(Category).count(),
        "documents":       db.query(Document).count(),
        "document_pages":  db.query(DocumentPage).count(),
        "chat_sessions":   db.query(ChatSession).count(),
        "messages":        db.query(Message).count(),
    }

    # ChromaDB
    try:
        vs = get_vector_store()
        chroma_count = vs._collection.count()
        chroma_status = "connected"
    except Exception as e:
        chroma_count = -1
        chroma_status = f"error: {e}"

    return {
        "sqlite": sqlite_stats,
        "chromadb": {
            "status": chroma_status,
            "total_vectors": chroma_count,
        }
    }


# ─────────────────────────────────────────────
# 2. Danh sách Documents + số chunks
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
            "document_scope": d.document_scope,
            "chunk_count": chunk_count,
            "created_at": str(d.created_at),
            "error_message": d.error_message,
        })
    return {"total": len(result), "items": result}


# ─────────────────────────────────────────────
# 3. Chi tiết Chunks của một Document
# ─────────────────────────────────────────────
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
# 4. ChromaDB – xem trực tiếp vectors đã lưu
# ─────────────────────────────────────────────
@router.get("/chroma/vectors", summary="Xem các Vector đã lưu trong ChromaDB")
def chroma_vectors(limit: int = 20):
    try:
        vs = get_vector_store()
        collection = vs._collection
        data = collection.get(limit=limit, include=["documents", "metadatas"])
        items = []
        for i, vid in enumerate(data["ids"]):
            items.append({
                "vector_id": vid,
                "metadata": data["metadatas"][i] if data["metadatas"] else {},
                "content_preview": (data["documents"][i][:200] if data["documents"] else ""),
            })
        return {"total_in_collection": collection.count(), "items": items}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# 5. Users
# ─────────────────────────────────────────────
@router.get("/users", summary="Danh sách người dùng")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "department": u.department,
            "role_id": u.role_id,
            "is_active": u.is_active,
            "last_login": str(u.last_login),
        }
        for u in users
    ]
