import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_current_user
from app.models.chat_model import ChatSession, Message
from app.models.doc_model import Document, UserDocPermission
from app.models.user_model import User
from app.schemas.chat_schema import ChatRequest
from app.services.rag_pipeline import query_rag, query_rag_stream
from app.services.context_manager import load_conversation_history

router = APIRouter()


def _resolve_allowed_doc_ids(db: Session, user: User, selected_doc_ids: list | None) -> list | None:
    """Trả về danh sách doc_id được phép search trong RAG.
    - Admin hoặc có quyền docs.view_all: None (không giới hạn)
    - User chọn tay: dùng selection đó (đã qua gate list_documents)
    - User không chọn: chỉ tài liệu được phân theo phòng ban + cấp trực tiếp
    """
    from app.api.dependencies import _is_action_allowed
    from app.models.doc_model import DepartmentDocPermission

    is_admin = user.role.name == "admin"
    can_view_all = is_admin or _is_action_allowed(user, "docs.view_all", db)

    if can_view_all:
        return selected_doc_ids or None

    if selected_doc_ids:
        # Lọc lại: chỉ cho phép doc_id mà user thực sự có quyền
        user_doc_ids = {
            p.document_id for p in db.query(UserDocPermission)
            .filter(UserDocPermission.user_id == user.id).all()
        }
        dept_doc_ids = set()
        if user.department_id:
            dept_doc_ids = {
                p.document_id for p in db.query(DepartmentDocPermission)
                .filter(DepartmentDocPermission.department_id == user.department_id).all()
            }
        allowed = user_doc_ids | dept_doc_ids
        return [d for d in selected_doc_ids if d in allowed] or []

    # Không chọn tay → dùng toàn bộ quyền phòng ban + user
    user_doc_ids = {
        p.document_id for p in db.query(UserDocPermission)
        .filter(UserDocPermission.user_id == user.id).all()
    }
    dept_doc_ids = set()
    if user.department_id:
        dept_doc_ids = {
            p.document_id for p in db.query(DepartmentDocPermission)
            .filter(DepartmentDocPermission.department_id == user.department_id).all()
        }
    return list(user_doc_ids | dept_doc_ids)


def _get_or_create_session(db: Session, user_id: int, session_id: Optional[int]) -> ChatSession:
    if session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id,
        ).first()
        if session:
            return session
    session = ChatSession(user_id=user_id, session_title=None)
    db.add(session)
    db.commit()
    db.refresh(session)
    # Adopt personal docs uploaded before session was created (session_id=None)
    db.query(Document).filter(
        Document.uploaded_by == user_id,
        Document.document_scope == "PERSONAL",
        Document.session_id == None,  # noqa: E711
    ).update({"session_id": session.id})
    db.commit()
    return session


@router.post("/message")
async def chat_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_or_create_session(db, current_user.id, request.session_id)

    # Load history TRƯỚC khi lưu user message mới
    history = load_conversation_history(db, session.id, max_turns=5)

    result = query_rag(
        query=request.content, db=db,
        allowed_doc_ids=_resolve_allowed_doc_ids(db, current_user, request.selected_doc_ids),
        conversation_history=history,
    )

    # Save messages
    db.add(Message(session_id=session.id, sender_type="user", content=request.content))
    db.add(Message(session_id=session.id, sender_type="assistant", content=result["answer"]))
    if not session.session_title:
        session.session_title = request.content[:60]
    session.updated_at = datetime.utcnow()
    db.commit()

    return {
        "reply": result["answer"],
        "citations": result["citations"],
        "suggestions": result.get("suggestions", []),
        "session_id": session.id,
    }


@router.post("/message/stream")
async def chat_message_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_or_create_session(db, current_user.id, request.session_id)

    # Load history TRƯỚC khi lưu user message mới
    history = load_conversation_history(db, session.id, max_turns=5)

    # Save user message immediately
    db.add(Message(session_id=session.id, sender_type="user", content=request.content))
    if not session.session_title:
        session.session_title = request.content[:60]
    db.commit()

    raw_gen = query_rag_stream(
        query=request.content, db=db,
        allowed_doc_ids=_resolve_allowed_doc_ids(db, current_user, request.selected_doc_ids),
        conversation_history=history,
    )
    session_id = session.id

    def saving_generator():
        import sqlalchemy
        full_content = ""
        corrected_content = ""

        for chunk in raw_gen:
            if not chunk.startswith("data: "):
                yield chunk
                continue
            try:
                data = json.loads(chunk[6:])
            except Exception:
                yield chunk
                continue

            event_type = data.get("type")

            if event_type == "token":
                full_content += data.get("content", "")
                yield chunk

            elif event_type == "corrected_text":
                corrected_content = data.get("content", "")
                yield chunk

            elif event_type == "done":
                # Save to DB ngay khi nhận done — không chờ relevant_spans/suggestions
                save_content = corrected_content or full_content
                message_id = None
                if save_content:
                    citations_json = json.dumps(data.get("citations", []), ensure_ascii=False)
                    msg = Message(
                        session_id=session_id,
                        sender_type="assistant",
                        content=save_content,
                        citations_json=citations_json or None,
                    )
                    db.add(msg)
                    db.execute(
                        sqlalchemy.text("UPDATE chat_sessions SET updated_at = :now WHERE id = :id"),
                        {"now": datetime.utcnow(), "id": session_id},
                    )
                    db.commit()
                    db.refresh(msg)
                    message_id = msg.id

                data["session_id"] = session_id
                if message_id:
                    data["message_id"] = message_id
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

            elif event_type == "suggestions" and message_id:
                # Lưu suggestions vào DB để hiện lại khi reload
                try:
                    db.execute(
                        sqlalchemy.text("UPDATE messages SET suggestions_json = :s WHERE id = :id"),
                        {"s": json.dumps(data.get("suggestions", []), ensure_ascii=False), "id": message_id},
                    )
                    db.commit()
                except Exception:
                    pass
                yield chunk

            else:
                # relevant_spans, thinking, reasoning, ...
                yield chunk

    return StreamingResponse(
        saving_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/suggestions")
async def get_suggestions(
    doc_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.doc_model import DocumentPage
    from app.services.rag_pipeline import _generate_suggestions

    allowed_ids: List[int] = []
    if doc_ids:
        try:
            allowed_ids = [int(x.strip()) for x in doc_ids.split(",") if x.strip().isdigit()]
        except Exception:
            pass

    if not allowed_ids:
        return {"suggestions": []}

    pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.document_id.in_(allowed_ids))
        .order_by(DocumentPage.chunk_index.asc())
        .limit(5)
        .all()
    )

    if not pages:
        return {"suggestions": []}

    context = "\n\n".join(p.raw_content for p in pages)
    suggestions = _generate_suggestions(
        context=context,
        answer="(Chưa có câu trả lời nào, hãy gợi ý câu hỏi phù hợp với nội dung tài liệu)",
    )
    return {"suggestions": suggestions}


@router.get("/sessions")
async def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import desc, case
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id, ChatSession.is_archived == False)
        .order_by(case((ChatSession.is_pinned == True, 0), else_=1), ChatSession.updated_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for s in sessions:
        msgs = sorted(s.messages, key=lambda m: m.created_at)
        last_msg = msgs[-1] if msgs else None
        result.append({
            "id": s.id,
            "title": s.session_title or "Cuộc trò chuyện",
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
            "message_count": len(msgs),
            "last_message": last_msg.content[:80] if last_msg else None,
            "is_pinned": s.is_pinned,
        })
    return {"sessions": result}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    from app.models.chat_model import Feedback as FeedbackModel
    msgs = sorted(session.messages, key=lambda m: m.created_at)

    # Build feedback lookup: message_id → reaction
    msg_ids = [m.id for m in msgs]
    feedbacks = db.query(FeedbackModel).filter(FeedbackModel.message_id.in_(msg_ids)).all()
    feedback_map = {f.message_id: f.reaction.lower() for f in feedbacks}

    return {
        "session_id": session_id,
        "title": session.session_title or "Cuộc trò chuyện",
        "messages": [
            {
                "id": m.id,
                "role": m.sender_type,
                "content": m.content,
                "citations": json.loads(m.citations_json) if m.citations_json else [],
                "suggestions": json.loads(m.suggestions_json) if m.suggestions_json else [],
                "created_at": m.created_at.isoformat(),
                "feedback": feedback_map.get(m.id),
            }
            for m in msgs
        ],
    }


class FeedbackBody(BaseModel):
    user_comment: Optional[str] = None

@router.post("/messages/{message_id}/feedback")
async def save_feedback(
    message_id: int,
    reaction: str,
    body: Optional[FeedbackBody] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.chat_model import Feedback as FeedbackModel
    msg = db.query(Message).join(ChatSession).filter(
        Message.id == message_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message không tồn tại")

    user_comment = body.user_comment if body else None

    existing = db.query(FeedbackModel).filter(FeedbackModel.message_id == message_id).first()
    if existing:
        existing.reaction = reaction
        existing.user_comment = user_comment
    else:
        db.add(FeedbackModel(message_id=message_id, reaction=reaction, user_comment=user_comment))
    db.commit()
    return {"success": True}


class UpdateSessionBody(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None

@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: int,
    body: UpdateSessionBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    if body.title is not None:
        session.session_title = body.title[:100]
    if body.is_pinned is not None:
        session.is_pinned = body.is_pinned
    db.commit()
    return {"success": True, "title": session.session_title, "is_pinned": session.is_pinned}


@router.delete("/sessions/{session_id}/messages/truncate")
async def truncate_session_messages(
    session_id: int,
    after_message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa tất cả messages sau message có id = after_message_id trong session.
    Dùng khi user edit & resend để tránh duplicate history khi reload session.
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    ref_msg = db.query(Message).filter(
        Message.id == after_message_id,
        Message.session_id == session_id,
    ).first()
    if not ref_msg:
        raise HTTPException(status_code=404, detail="Message không tồn tại")

    db.query(Message).filter(
        Message.session_id == session_id,
        Message.created_at > ref_msg.created_at,
    ).delete(synchronize_session=False)
    db.commit()
    return {"success": True}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    db.delete(session)
    db.commit()
    return {"success": True}
