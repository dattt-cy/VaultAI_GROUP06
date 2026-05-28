"""Admin – Chat Session Monitor & Feedback."""
import json as _json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.chat_model import ChatSession, Feedback, Message
from app.models.doc_model import Document
from app.models.user_model import User

router = APIRouter()


# ─────────────────────────────────────────────
# Chat Monitor
# ─────────────────────────────────────────────
@router.get("/chat/sessions", summary="Tất cả phiên chat")
def list_all_sessions(
    skip: int = 0,
    limit: int = 20,
    search: str = "",
    is_archived: str = "",
    db: Session = Depends(get_db),
):
    query = db.query(ChatSession)

    if is_archived == "true":
        query = query.filter(ChatSession.is_archived == True)
    elif is_archived == "false":
        query = query.filter(ChatSession.is_archived == False)

    if search:
        query = query.join(User, ChatSession.user_id == User.id).filter(
            (User.email.ilike(f"%{search}%")) |
            (User.username.ilike(f"%{search}%")) |
            (User.full_name.ilike(f"%{search}%"))
        )

    total = query.count()
    sessions = query.order_by(ChatSession.created_at.desc()).offset(skip).limit(limit).all()

    user_ids = {s.user_id for s in sessions}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    return {
        "total": total,
        "items": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "username": users[s.user_id].username if s.user_id in users else None,
                "full_name": users[s.user_id].full_name if s.user_id in users else None,
                "email": users[s.user_id].email if s.user_id in users else None,
                "session_title": s.session_title,
                "is_archived": s.is_archived,
                "message_count": db.query(Message).filter(Message.session_id == s.id).count(),
                "created_at": str(s.created_at),
            }
            for s in sessions
        ],
    }


@router.get("/chat/sessions/{session_id}/messages", summary="Tin nhắn của phiên chat")
def get_session_messages(session_id: int, db: Session = Depends(get_db)):
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at)
        .all()
    )
    return [
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "content": m.content,
            "prompt_tokens": m.prompt_tokens,
            "completion_tokens": m.completion_tokens,
            "latency_ms": m.latency_ms,
            "created_at": str(m.created_at),
        }
        for m in messages
    ]


# ─────────────────────────────────────────────
# Feedback
# ─────────────────────────────────────────────
@router.get("/feedback", summary="Tất cả phản hồi người dùng")
def list_all_feedback(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    feedbacks = (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    total = db.query(Feedback).count()

    items = []
    for f in feedbacks:
        item = {
            "id": f.id,
            "message_id": f.message_id,
            "reaction": f.reaction,
            "user_comment": f.user_comment,
            "corrected_text": f.corrected_text,
            "resolved": f.resolved if f.resolved is not None else False,
            "created_at": str(f.created_at),
            "user_question": None,
            "ai_answer": None,
            "citations": [],
        }

        msg = db.query(Message).filter(Message.id == f.message_id).first()
        if msg:
            item["ai_answer"] = msg.content

            user_msg = (
                db.query(Message)
                .filter(
                    Message.session_id == msg.session_id,
                    Message.id < msg.id,
                    Message.sender_type == "user",
                )
                .order_by(Message.id.desc())
                .first()
            )
            if user_msg:
                item["user_question"] = user_msg.content

            try:
                raw_citations = _json.loads(msg.citations_json or "[]")
                enriched = []
                for c in raw_citations:
                    doc_id = c.get("document_id")
                    doc = db.query(Document).filter(Document.id == doc_id).first() if doc_id else None
                    enriched.append({
                        "document_id": doc_id,
                        "document_title": doc.title if doc else c.get("sourceFile", "Unknown"),
                        "chunk_index": c.get("chunk_index"),
                        "excerpt": c.get("content_preview", ""),
                        "relevant_spans": c.get("relevant_spans", []),
                    })
                item["citations"] = enriched
            except Exception:
                pass

        items.append(item)

    return {"total": total, "items": items}


@router.patch("/feedback/{feedback_id}/resolve", summary="Đánh dấu phản hồi đã xử lý")
def resolve_feedback(feedback_id: int, db: Session = Depends(get_db)):
    f = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback không tồn tại")
    f.resolved = not f.resolved
    db.commit()
    return {"success": True, "resolved": f.resolved}


@router.get("/feedback/flagged-documents", summary="Tài liệu bị báo lỗi nhiều nhất")
def flagged_documents(db: Session = Depends(get_db)):
    bad_feedbacks = (
        db.query(Feedback)
        .filter(Feedback.reaction.in_(["DISLIKE", "HALLUCINATED"]))
        .all()
    )

    doc_counts: dict = {}
    for f in bad_feedbacks:
        msg = db.query(Message).filter(Message.id == f.message_id).first()
        if not msg or not msg.citations_json:
            continue
        try:
            citations = _json.loads(msg.citations_json)
        except Exception:
            continue
        seen = set()
        for c in citations:
            doc_id = c.get("document_id")
            if not doc_id or doc_id in seen:
                continue
            seen.add(doc_id)
            if doc_id not in doc_counts:
                doc = db.query(Document).filter(Document.id == doc_id).first()
                doc_counts[doc_id] = {
                    "document_id": doc_id,
                    "document_title": doc.title if doc else c.get("sourceFile", "Unknown"),
                    "bad_count": 0,
                    "unresolved_count": 0,
                }
            doc_counts[doc_id]["bad_count"] += 1
            if not f.resolved:
                doc_counts[doc_id]["unresolved_count"] += 1

    result = sorted(doc_counts.values(), key=lambda x: x["bad_count"], reverse=True)
    return {"items": result}
