import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_current_user
from app.models.chat_model import ChatSession, Message
from app.models.user_model import User
from app.schemas.chat_schema import ChatRequest
from app.services.rag_pipeline import query_rag, query_rag_stream

router = APIRouter()


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
    return session


@router.post("/message")
async def chat_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_or_create_session(db, current_user.id, request.session_id)

    result = query_rag(
        query=request.content, db=db,
        session_id=session.id, allowed_doc_ids=request.selected_doc_ids,
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

    # Save user message immediately
    db.add(Message(session_id=session.id, sender_type="user", content=request.content))
    if not session.session_title:
        session.session_title = request.content[:60]
    db.commit()

    raw_gen = query_rag_stream(
        query=request.content, db=db, allowed_doc_ids=request.selected_doc_ids,
    )
    session_id = session.id

    def saving_generator():
        full_content = ""
        for chunk in raw_gen:
            if chunk.startswith("data: "):
                try:
                    data = json.loads(chunk[6:])
                    if data.get("type") == "token":
                        full_content += data.get("content", "")
                        yield chunk
                    elif data.get("type") == "done":
                        # Inject session_id so frontend can track it
                        data["session_id"] = session_id
                        yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                    else:
                        yield chunk
                except Exception:
                    yield chunk
            else:
                yield chunk

        # Persist assistant message after stream completes
        if full_content:
            save_db = db
            save_db.add(Message(
                session_id=session_id,
                sender_type="assistant",
                content=full_content,
            ))
            save_db.execute(
                __import__("sqlalchemy").text(
                    "UPDATE chat_sessions SET updated_at = :now WHERE id = :id"
                ),
                {"now": datetime.utcnow(), "id": session_id},
            )
            save_db.commit()

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
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id, ChatSession.is_archived == False)
        .order_by(ChatSession.updated_at.desc())
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

    msgs = sorted(session.messages, key=lambda m: m.created_at)
    return {
        "session_id": session_id,
        "title": session.session_title or "Cuộc trò chuyện",
        "messages": [
            {
                "id": m.id,
                "role": m.sender_type,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in msgs
        ],
    }


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
