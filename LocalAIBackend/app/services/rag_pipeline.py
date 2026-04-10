from sqlalchemy.orm import Session
from .hybrid_retriever import hybrid_retrieve
from .llm_engine import get_llm, check_hallucination, apply_pii_masking
from langchain_core.prompts import PromptTemplate

# Prompt template nâng cấp – hỗ trợ trích dẫn nguồn (chunk_index, document_id)
QA_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Bạn là một trợ lý AI thông minh, chuyên hỗ trợ phân tích tài liệu nội bộ.

HƯỚNG DẪN:
1. TẤT CẢ PHẢN HỒI PHẢI BẰNG TIẾNG VIỆT 100%. (CRITICAL: ALWAYS RESPOND IN VIETNAMESE. DO NOT USE ENGLISH UNLESS IT'S A UNAVOIDABLE TECHNICAL TERM).
2. Chỉ sử dụng các thông tin trong phần "NGỮ CẢNH" bên dưới để trả lời câu hỏi. Cấm tự bịa đặt hoặc suy diễn thông tin (No hallucination).
3. TRÍCH DẪN ĐIỀU KHOẢN CHÍNH XÁC: Đặc biệt quan sát kỹ số thứ tự điều khoản, bộ phận, số tiền. Không bao giờ được lấy nội dung của mục này gán cho mục khác.
4. Nếu "NGỮ CẢNH" không chứa câu trả lời, hãy nói: "Tôi không tìm thấy thông tin này trong tài liệu nội bộ."
5. TRÌNH BÀY CHUYÊN NGHIỆP:
   - Trả lời bằng tiếng Việt chuyên nghiệp, cấu trúc rõ ràng, ngắt đoạn hợp lý.
   - Sử dụng Markdown để làm nổi bật văn bản.
   - Bắt buộc bôi đen (**in đậm**) các Từ Khóa quan trọng, Số Liệu, Số Tiền, Thời Gian và Tên Điều Khoản.
   - Phân chia câu trả lời thành các gạch đầu dòng (-) hoặc danh sách đánh số (1, 2, 3) để dể đọc.

--- NGỮ CẢNH ---
{context}
----------------

Câu hỏi: {question}
Câu trả lời tiếng Việt:
"""
)

SUGGESTIONS_PROMPT = PromptTemplate(
    input_variables=["context", "answer"],
    template="""Dựa vào ngữ cảnh tài liệu sau đây và câu trả lời vừa được cung cấp, hãy đề xuất đúng 3 câu hỏi tiếp theo mà người dùng có thể muốn hỏi để tìm hiểu sâu hơn.

Yêu cầu:
- Mỗi câu hỏi đặt trên một dòng riêng biệt
- Bắt đầu mỗi dòng bằng số thứ tự: 1. 2. 3.
- Câu hỏi ngắn gọn (dưới 15 từ), rõ ràng, kéo theo chủ đề từ tài liệu
- Hoàn toàn bằng tiếng Việt
- Không giải thích gì thêm, chỉ viết 3 câu hỏi

NGỮ CẢNH:
{context}

CÂU TRẢ LỜI Vừa Cung Cấp:
{answer}

3 CÂU HỎI GỢI Ý:
"""
)


def _generate_suggestions(context: str, answer: str) -> list:
    """
    Sinh 3 câu hỏi gợi ý tiếp theo dựa trên ngữ cảnh + câu trả lời.
    Trả về danh sách rỗng nếu LLM lỗi.
    """
    try:
        llm = get_llm()
        prompt = SUGGESTIONS_PROMPT.format(context=context[:2000], answer=answer[:500])
        raw = llm.invoke(prompt)
        lines = []
        for line in raw.strip().splitlines():
            line = line.strip()
            # Loại bỏ số thứ tự đầu dòng: "1. ", "2. ", "3. "
            if line and line[0].isdigit() and len(line) > 2 and line[1] in '.)':
                q = line[2:].strip()
                if q:
                    lines.append(q)
            elif line and not line[0].isdigit() and len(line) > 10:
                lines.append(line)
            if len(lines) == 3:
                break
        return lines[:3]
    except Exception as e:
        print(f"[Suggestions ERROR] {e}")
        return []


def query_rag(query: str, db: Session, session_id: int = None, allowed_doc_ids: list = None):
    """
    Luồng RAG nâng cấp dùng Hybrid Retriever.
    Thay thế toàn bộ search_documents() cũ bằng hybrid_retrieve().
    """
    lower_query = query.lower()
    intent_keywords = [
        "bạn có thể làm", 
        "chức năng của",
        "khả năng của", 
        "bạn làm được gì", 
        "bạn là ai", 
        "giới thiệu bản thân",
        "hệ thống làm được gì",
        "làm được những gì"
    ]
    if any(k in lower_query for k in intent_keywords):
        return {
            "answer": "Xin chào! Tôi là **Trợ lý AI Nội bộ (Local AI)** – Hệ thống trí tuệ nhân tạo chuyên biệt được thiết kế để quản lý và khai thác tri thức của doanh nghiệp một cách bảo mật.\n\nDưới đây là các tính năng cốt lõi tôi có thể hỗ trợ bạn:\n\n* **🔍 Tìm Kiếm Ngữ Nghĩa (Hybrid Search):** Quét và hiểu ý nghĩa của hàng vạn trang tài liệu (PDF, Word, TXT) chỉ trong vài giây, thay vì chỉ tìm theo từ khóa thô cứng.\n* **🧠 Hỏi Đáp Tập Trung (RAG):** Đọc nội dung tài liệu của bạn, phân tích để chắt lọc câu trả lời chính xác nhất, sau đó trình bày lại bằng ngôn ngữ tự nhiên.\n* **📑 Trích Dẫn Cụ Thể, Minh Bạch:** Mọi thông tin tôi cung cấp bắt buộc phải có nguồn gốc rõ ràng (Tên file, Số trang, Đoạn văn) để bạn dễ dàng kiểm chứng lại chống \"ảo giác\".\n* **🛡️ Bảo Mật Tuyệt Đối (Air-gapped):** Mọi quá trình suy luận của tôi diễn ra 100% trên phần cứng máy chủ nội bộ (Offline). Dữ liệu nhạy cảm của bạn sẽ không bao giờ bị đưa ra ngoài Internet.\n\nBạn đã sẵn sàng chưa? Hãy thử đặt bất kỳ câu hỏi nào liên quan đến các tài liệu đang có trên hệ thống!",
            "citations": [],
            "suggestions": []
        }

    # 1. Hybrid Retrieval (Semantic + FTS5 + Page Expansion)
    chunks = hybrid_retrieve(db=db, query=query, top_k=5, neighbor_window=1, allowed_doc_ids=allowed_doc_ids)

    if not chunks:
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu nội bộ.",
            "citations": [],
            "suggestions": []
        }

    # 2. Ghép ngữ cảnh – sắp theo document_id và chunk_index để đọc mạch lạc
    context_parts = []
    citations = []

    for chunk in chunks:
        context_parts.append(chunk.content)
        citations.append({
            "content_preview": chunk.content[:120] + "...",
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "sourceFile": chunk.page_metadata.get("source", f"Tài liệu {chunk.document_id}"),
            "rrf_score": round(chunk.rrf_score, 4),
            "source_type": chunk.source_type,        # hybrid | neighbor_expand
        })

    merged_context = "\n\n".join(context_parts)

    # 3. Anti-hallucination check
    if check_hallucination(merged_context, query):
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu hoặc câu hỏi không liên quan đến dữ liệu hệ thống.",
            "citations": [],
            "suggestions": []
        }

    # 4. Gọi LLM
    llm = get_llm()
    prompt = QA_PROMPT.format(context=merged_context, question=query)
    raw_response = llm.invoke(prompt)

    # 5. Lọc PII
    safe_response = apply_pii_masking(raw_response)

    # 6. Sinh gợi ý câu hỏi tiếp theo
    suggestions = _generate_suggestions(merged_context, safe_response)

    return {
        "answer": safe_response,
        "citations": citations,
        "suggestions": suggestions,
    }
