from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from app.schemas.chat_schema import ChatRequest
from app.services.rag_pipeline import query_rag, query_rag_stream

router = APIRouter()

@router.post("/message")
async def chat_message(
    request: ChatRequest, 
    db: Session = Depends(get_db)
):
    # Call the RAG pipeline
    result = query_rag(query=request.content, db=db, session_id=request.session_id, allowed_doc_ids=request.selected_doc_ids)
    
    return {
        "reply": result["answer"],
        "citations": result["citations"],
        "suggestions": result.get("suggestions", []),
    }


@router.post("/message/stream")
async def chat_message_stream(request: ChatRequest, db: Session = Depends(get_db)):
    return StreamingResponse(
        query_rag_stream(query=request.content, db=db, allowed_doc_ids=request.selected_doc_ids),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/suggestions")
async def get_suggestions(
    doc_ids: Optional[str] = Query(None, description="Danh sách doc_id cách nhau bởi dấu phẩy"),
    db: Session = Depends(get_db),
):
    """
    Sinh câu hỏi gợi ý dựa trên nội dung tài liệu đã chọn.
    Lấy sample chunks từ ChromaDB rồi dùng LLM để tạo câu hỏi.
    """
    from app.models.doc_model import DocumentPage
    from app.services.rag_pipeline import _generate_suggestions

    # Parse doc_ids
    allowed_ids: List[int] = []
    if doc_ids:
        try:
            allowed_ids = [int(x.strip()) for x in doc_ids.split(",") if x.strip().isdigit()]
        except Exception:
            pass

    if not allowed_ids:
        return {"suggestions": []}

    # Lấy tối đa 5 chunks từ các tài liệu đã chọn
    pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.document_id.in_(allowed_ids))
        .order_by(DocumentPage.chunk_index.asc())
        .limit(5)
        .all()
    )

    if not pages:
        return {"suggestions": []}

    # Ghép context từ các chunks
    context = "\n\n".join(p.raw_content for p in pages)

    # Sinh gợi ý
    suggestions = _generate_suggestions(context=context, answer="(Chưa có câu trả lời nào, hãy gợi ý câu hỏi phù hợp với nội dung tài liệu)")

    return {"suggestions": suggestions}


@router.get("/sessions")
async def get_sessions(db: Session = Depends(get_db)):
    return {"sessions": []}
