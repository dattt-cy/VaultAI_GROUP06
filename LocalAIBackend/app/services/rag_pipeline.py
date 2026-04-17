import re
from sqlalchemy.orm import Session
from .hybrid_retriever import hybrid_retrieve, get_reranker
from .llm_engine import safe_llm_invoke, check_hallucination, apply_pii_masking, log_english_leakage
from langchain_core.prompts import PromptTemplate


# ---------------------------------------------------------------------------
# Prompt QA — chỉ chứa hướng dẫn format và nội dung user
# Phần ngôn ngữ (tiếng Việt 100%) đã được xử lý bởi SystemMessage trong llm_engine.py
# ---------------------------------------------------------------------------

QA_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Bạn là chuyên gia phân tích tài liệu nội bộ. Chỉ dùng NGỮ CẢNH dưới đây. Tuyệt đối không tự bịa thông tin.

--- NGỮ CẢNH ---
{context}
-----------------

Câu hỏi: {question}

LƯU Ý TỐI QUAN TRỌNG TRƯỚC KHI TRẢ LỜI:
1. ĐỊNH DẠNG ĐẸP MẮT: Bắt đầu thẳng vào vấn đề. LUÔN LUÔN trình bày dưới dạng danh sách (Bullet points: -, *) nếu có nhiều ý. Bôi đậm (**in đậm**) các thông tin quan trọng.
2. LUẬT TRÍCH DẪN (BẮT BUỘC): Bắt buộc chèn kí hiệu nguồn bằng CHỮ CÁI (ví dụ: [A], [B]) vào cuối MỌI CÂU VĂN mang thông tin (ngay trước dấu chấm câu).
   - Tuyệt đối không tự bịa mã nguồn! Tính chính xác của trích dẫn quan trọng hơn số lượng. Nếu thông tin chỉ nằm ở TÀI LIỆU B, hãy dùng thẻ [B] cho tất cả các câu từ tài liệu đó.
   - Ví dụ chuẩn: 
     * Hệ thống được xây dựng trên kiến trúc MVC [A].
     * Tiền tệ ràng buộc từ 1.000 VNĐ [A][C]. Tên chiến dịch từ 10 đến 200 ký tự [C].
3. Ghi mã nguồn CHỮ CÁI dựa theo đúng [TÀI LIỆU X] ở phía trên.

Trả lời:"""
)



# ---------------------------------------------------------------------------
# Prompt Suggestions — viết thuần tiếng Việt
# ---------------------------------------------------------------------------

SUGGESTIONS_PROMPT = PromptTemplate(
    input_variables=["context", "answer"],
    template="""Tạo đúng 3 câu hỏi tiếp theo dựa trên nội dung tài liệu.

Quy tắc:
- Đánh số thứ tự: 1. 2. 3.
- Mỗi câu một dòng, không viết thêm bất kỳ đoạn giới thiệu hay kết luận nào.

Nội dung tài liệu:
{context}

Câu trả lời trước đó:
{answer}

3 câu hỏi tiếp theo:"""
)



def _generate_suggestions(context: str, answer: str) -> list:
    """
    Sinh 3 câu hỏi gợi ý tiếp theo dựa trên ngữ cảnh + câu trả lời.
    Trả về danh sách rỗng nếu LLM lỗi.
    """
    try:
        prompt = SUGGESTIONS_PROMPT.format(context=context[:2000], answer=answer[:500])
        raw = safe_llm_invoke(prompt)
        lines = []
        for line in raw.strip().splitlines():
            line = line.strip()
            match = re.match(r'^(\d+)[\.\)]\s*(.+)$', line)
            if match:
                q = match.group(2).strip()
                q = q.replace('**', '').replace('*', '')
                if q and len(q) > 5:
                    lines.append(q)
            if len(lines) == 3:
                break
        return lines[:3]
    except Exception as e:
        print(f"[Suggestions ERROR] {e}")
        return []


def _extract_relevant_spans_dynamic(chunk_queries: list[str], chunks: list) -> list[list[str]]:
    """
    Sử dụng chính câu văn mà LLM đã trích dẫn để tìm kiếm lại trong chunk gốc.
    """
    try:
        reranker = get_reranker()
        if not reranker:
            return [[] for _ in chunks]
    except Exception as e:
        print(f"[SubChunk] Không load được reranker: {e}")
        return [[] for _ in chunks]

    all_pairs = []
    chunk_ranges = []

    for i, chunk in enumerate(chunks):
        c_query = chunk_queries[i]
        sentences = [
            s.strip()
            for s in re.split(r'(?<=[.!?\n])\s+', chunk.content)
            if len(s.strip()) > 15
        ]
        start = len(all_pairs)
        all_pairs.extend([[c_query, s] for s in sentences])
        chunk_ranges.append((start, len(all_pairs), sentences))

    results: list[list[str]] = []
    if not all_pairs:
        return [[] for _ in chunks]

    try:
        all_scores = reranker.predict(all_pairs)
    except Exception as e:
        print(f"[SubChunk ERROR] Batch predict thất bại: {e}")
        return [[] for _ in chunks]

    for (start, end, sentences) in chunk_ranges:
        if not sentences:
            results.append([])
            continue
        chunk_scores = all_scores[start:end].tolist() if hasattr(all_scores, 'tolist') else list(all_scores[start:end])
        scored = sorted(zip(chunk_scores, sentences), key=lambda x: x[0], reverse=True)
        # Bắt buộc điểm cross-encoder > 0.0 để loại bỏ câu không liên quan
        best = [s for score, s in scored if score > 0.0][:2]
        results.append(best)

    return results


def query_rag(query: str, db: Session, session_id: int = None, allowed_doc_ids: list = None):
    """
    Luồng RAG nâng cấp dùng Hybrid Retriever.
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
    chunks = hybrid_retrieve(db=db, query=query, top_k=10, neighbor_window=1, allowed_doc_ids=allowed_doc_ids)

    if not chunks:
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu nội bộ.",
            "citations": [],
            "suggestions": []
        }

    # 2. Ghép ngữ cảnh
    context_parts = []
    for i, chunk in enumerate(chunks):
        letter = chr(65 + (i % 26)) # 0 -> A, 1 -> B...
        context_parts.append(f"[TÀI LIỆU {letter}]\n{chunk.content}")

    merged_context = "\n\n".join(context_parts)

    # 3. Anti-hallucination check TRƯỚC KHI GỌI LLM
    if check_hallucination(merged_context, query):
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu hoặc câu hỏi không liên quan đến dữ liệu hệ thống.",
            "citations": [],
            "suggestions": []
        }

    # 4. Gọi LLM
    prompt = QA_PROMPT.format(context=merged_context, question=query)
    raw_response = safe_llm_invoke(prompt)
    safe_response = apply_pii_masking(raw_response)
    log_english_leakage(safe_response)

    # TRICK: Ép AI dùng Chữ Cái [A], [B] để trị bệnh tự đồng bộ Số Thứ Tự -> Lúc này ta Convert ngược lại về [1], [2] cho Frontend!
    def map_letter_to_int(match):
        letter = match.group(1)
        return f"[{ord(letter) - 64}]"
    
    safe_response = re.sub(r'\[([A-Z])\]', map_letter_to_int, safe_response)

    # 5. Khai thác SEARCH & HIGHLIGHT thông minh: 
    # Bóc tách chính xác các câu AI vừa biên dịch để làm mồi tìm kiếm ngược về mã nguồn gốc
    chunk_queries = [query] * len(chunks)
    for sentence in re.split(r'(?<=[.!?\n])', safe_response):
        matches = re.findall(r'\[(\d+)\]', sentence)
        for m in matches:
            idx = int(m) - 1
            if 0 <= idx < len(chunks):
                if chunk_queries[idx] == query:
                    chunk_queries[idx] = sentence.strip()
                else:
                    chunk_queries[idx] += " " + sentence.strip()

    # 6. Rerank tìm highlight (Dynamic Spans)
    all_relevant_spans = _extract_relevant_spans_dynamic(chunk_queries, chunks)

    # 7. Đóng gói citations mượt mà
    citations = []
    for i, chunk in enumerate(chunks):
        citations.append({
            "content_preview": chunk.content[:120] + "...",
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "page": chunk.chunk_index + 1,
            "sourceFile": chunk.page_metadata.get("source", f"Tài liệu {chunk.document_id}"),
            "rerank_score": round(chunk.rerank_score, 4),
            "source_type": chunk.source_type,
            "relevant_spans": all_relevant_spans[i] if i < len(all_relevant_spans) else [],
        })

    # 8. Sinh gợi ý câu hỏi tiếp theo
    suggestions = _generate_suggestions(merged_context, safe_response)

    return {
        "answer": safe_response,
        "citations": citations,
        "suggestions": suggestions,
    }
