import re
import json
from typing import Generator
from sqlalchemy.orm import Session
from .hybrid_retriever import hybrid_retrieve, get_reranker, hybrid_retrieve_multi, _retrieval_is_confident
from .llm_engine import safe_llm_invoke, stream_llm_invoke, stream_llm_invoke_with_thinking, check_hallucination, apply_pii_masking, log_english_leakage
from .context_manager import (
    format_history_block,
    needs_rewrite, rewrite_query, expand_query,
)
from app.core.config import settings
from langchain_core.prompts import PromptTemplate


# ---------------------------------------------------------------------------
# Prompt QA — cấu trúc 3 bước bắt buộc để AI suy luận rõ ràng hơn
# {history_block} = "" khi không có history (không ảnh hưởng prompt)
# ---------------------------------------------------------------------------

QA_PROMPT = PromptTemplate(
    input_variables=["context", "history_block", "question"],
    template="""Bạn là chuyên gia phân tích tài liệu nội bộ. Chỉ dùng thông tin từ NGỮ CẢNH bên dưới. Không bịa thêm bất kỳ thông tin nào.

--- NGỮ CẢNH ---
{context}
-----------------

{history_block}
Câu hỏi: {question}

HƯỚNG DẪN ĐỊNH DẠNG (áp dụng ngay, không viết các nhãn bước ra):
1. Nếu ngữ cảnh KHÔNG có thông tin liên quan → chỉ viết đúng một câu: "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp." Không thêm gì khác.
2. Nếu có thông tin → tổng hợp và trình bày trực tiếp theo định dạng sau:
   - Khi liệt kê các bước/mục có nội dung con: dùng bullet cha (**Tiêu đề bước**), nội dung con thụt vào 2 dấu cách "  -" (KHÔNG để nội dung con cùng cấp với tiêu đề)
   - Bôi đậm (**...**) số tiền, ngưỡng, tên điều khoản, mốc thời gian
   - Nhãn nguồn [A]/[B]/[C]: chỉ đặt MỘT LẦN ở cuối nhóm bullet, KHÔNG đặt sau mỗi dòng riêng lẻ
   - KHÔNG viết câu "Tôi không tìm thấy..." nếu đã có thông tin trả lời
   - Nếu chỉ một phần câu hỏi có thông tin: trả lời phần đó, bỏ qua phần không có

VÍ DỤ ĐỊNH DẠNG ĐÚNG (nested bullet — nội dung con thụt vào trong):
Q: "Quy trình thanh toán gồm các bước nào?"
A: Quy trình thanh toán gồm các bước sau:
- **Bước 1: Lập đề nghị thanh toán**
  - Điền phiếu đề nghị trên hệ thống ERP
  - Đính kèm hóa đơn VAT hợp lệ, hợp đồng liên quan [A]
- **Bước 2: Kiểm tra chứng từ**
  - Kế toán xác nhận tính hợp lệ theo Nghị định 123/2020
  - Đối chiếu với đơn đặt hàng đã ký [A]
- **Chi tiêu khẩn cấp**: hạn mức tối đa **10.000.000 đồng/lần**, cần bổ sung chứng từ trong **3 ngày làm việc**. [B]

Trả lời:"""
)

# Directive cấu trúc hóa chain-of-thought cho thinking model
_THINKING_DIRECTIVE = """Trước khi trả lời, hãy suy nghĩ theo cấu trúc sau trong phần suy nghĩ nội tâm:
[PHÂN TÍCH CÂU HỎI]: Câu hỏi yêu cầu thông tin gì? Từ khóa chính là gì?
[XEM XÉT TÀI LIỆU]: Tài liệu nào ([A],[B],[C]...) có thông tin liên quan? Độ tin cậy?
[KẾT LUẬN]: Thông tin có đủ để trả lời không? Cần đặt điều kiện/giới hạn gì?

"""



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
        best = [s for score, s in scored if score > -2.0][:3]
        results.append(best)

    return results


def _process_llm_citations(response: str, num_chunks: int) -> tuple[str, dict]:
    """
    Xử lý response chứa inline citations [A],[B],[C] do LLM tự chèn:
    - Gom markers của từng dòng, chuyển về cuối dòng dưới dạng [N]
    - Trả về (response đã format, citation_source_lines)

    Tại sao dùng LLM tự cite thay vì reranker:
    LLM đọc context và biết chính xác "thông tin này từ TÀI LIỆU A/B/C".
    Reranker đoán ngược sau khi đã tạo text — dễ nhầm khi chunks cùng chủ đề.
    """
    lines = response.split('\n')
    result_lines = []
    citation_source_lines: dict[int, list[str]] = {}

    for line in lines:
        markers = re.findall(r'\[([A-Z])\]', line)
        # Xóa markers khỏi nội dung dòng
        clean = re.sub(r'\s*\[([A-Z])\]\s*', ' ', line)
        clean = re.sub(r'\s+', ' ', clean).strip()

        if markers and clean:
            # Chọn marker xuất hiện nhiều nhất (hoặc đầu tiên nếu bằng nhau)
            best_letter = max(set(markers), key=markers.count)
            chunk_idx = ord(best_letter) - 65  # A→0, B→1, C→2 ...
            if 0 <= chunk_idx < num_chunks:
                result_lines.append(f"{clean} [{chunk_idx + 1}]")
                citation_source_lines.setdefault(chunk_idx, []).append(clean)
                continue

        # Dòng trống hoặc không có citation → giữ nguyên
        result_lines.append(line)

    return '\n'.join(result_lines), citation_source_lines


def query_rag(query: str, db: Session, allowed_doc_ids: list = None,
              conversation_history: list = None):
    """
    Luồng RAG nâng cấp dùng Hybrid Retriever.
    conversation_history: list[dict] từ load_conversation_history() — đã được load sẵn ở chat.py
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

    history = conversation_history or []

    # 0. Query rewriting: viết lại câu hỏi mơ hồ trước khi retrieval
    retrieval_query = query
    if history and needs_rewrite(query, history):
        retrieval_query = rewrite_query(query, history, safe_llm_invoke)
        if retrieval_query != query:
            print(f"[QueryRewrite] '{query}' → '{retrieval_query}'")

    # 1. Hybrid Retrieval (Semantic + FTS5 + Page Expansion)
    chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=7, neighbor_window=1, allowed_doc_ids=allowed_doc_ids)

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
    if check_hallucination(merged_context, retrieval_query):
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu hoặc câu hỏi không liên quan đến dữ liệu hệ thống.",
            "citations": [],
            "suggestions": []
        }

    # 4. Gọi LLM với history block
    history_block = format_history_block(history)
    prompt = QA_PROMPT.format(context=merged_context, history_block=history_block, question=query)
    raw_response = safe_llm_invoke(prompt)
    safe_response = apply_pii_masking(raw_response)
    log_english_leakage(safe_response)

    # 5. Xóa context labels, giữ lại [A]/[B] citations do LLM chèn
    safe_response = re.sub(r'\[\d+\]', '', safe_response)
    safe_response = re.sub(r'\[TÀI LIỆU\s+[A-Z0-9]+\]', '', safe_response).strip()

    # 6. Xử lý LLM citations: gom [A][B] về cuối dòng, map sang [1][2]
    safe_response, citation_source_lines = _process_llm_citations(safe_response, len(chunks))

    # 7. Build chunk_queries cho relevant spans
    chunk_queries = [query] * len(chunks)
    for chunk_idx, src_lines in citation_source_lines.items():
        if 0 <= chunk_idx < len(chunks):
            chunk_queries[chunk_idx] = " ".join(src_lines)

    # 8. Rerank tìm highlight (Dynamic Spans)
    all_relevant_spans = _extract_relevant_spans_dynamic(chunk_queries, chunks)

    # 8. Đóng gói citations
    citations = []
    for i, chunk in enumerate(chunks):
        citations.append({
            "content_preview": chunk.content,
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "page": chunk.chunk_index + 1,
            "sourceFile": chunk.page_metadata.get("source", f"Tài liệu {chunk.document_id}"),
            "rerank_score": round(chunk.rerank_score, 4),
            "source_type": chunk.source_type,
            "relevant_spans": all_relevant_spans[i] if i < len(all_relevant_spans) else [],
            "source_lines": citation_source_lines.get(i, []),
        })

    # 8. Sinh gợi ý câu hỏi tiếp theo
    suggestions = _generate_suggestions(merged_context, safe_response)

    return {
        "answer": safe_response,
        "citations": citations,
        "suggestions": suggestions,
    }


# ---------------------------------------------------------------------------
# SSE Streaming variant
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def query_rag_stream(query: str, db: Session, allowed_doc_ids: list = None,
                     conversation_history: list = None) -> Generator[str, None, None]:
    """
    Streaming version của query_rag — yield SSE events:
      {"type":"thinking","step":"..."}   — bước xử lý pipeline
      {"type":"token","content":"..."}   — từng token LLM sinh ra
      {"type":"done","citations":[...],"suggestions":[...]}
    conversation_history: list[dict] từ load_conversation_history() — đã được load sẵn ở chat.py
    """
    history = conversation_history or []

    # 0. Query rewriting nếu câu hỏi mơ hồ
    retrieval_query = query
    if history and needs_rewrite(query, history):
        yield _sse({"type": "thinking", "step": "💬 Đang phân tích ngữ cảnh hội thoại..."})
        retrieval_query = rewrite_query(query, history, safe_llm_invoke)
        if retrieval_query != query:
            print(f"[QueryRewrite] '{query}' → '{retrieval_query}'")
            yield _sse({"type": "thinking", "step": f"🔄 Đã làm rõ câu hỏi: {retrieval_query[:60]}..."})

    yield _sse({"type": "thinking", "step": "🔍 Đang tìm kiếm tài liệu liên quan..."})

    chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=7, neighbor_window=1, allowed_doc_ids=allowed_doc_ids)

    if not chunks:
        yield _sse({"type": "thinking", "step": "⚠️ Không tìm thấy tài liệu phù hợp"})
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    # Adaptive retrieval: nếu confidence thấp, mở rộng tìm kiếm với query variants
    if not _retrieval_is_confident(chunks):
        yield _sse({"type": "thinking", "step": "⚡ Đang mở rộng tìm kiếm để cải thiện kết quả..."})
        query_variants = expand_query(retrieval_query, safe_llm_invoke)
        if len(query_variants) > 1:
            expanded_chunks = hybrid_retrieve_multi(
                db=db, queries=query_variants, top_k=7,
                neighbor_window=1, allowed_doc_ids=allowed_doc_ids,
            )
            if expanded_chunks:
                chunks = expanded_chunks

    doc_ids = {c.document_id for c in chunks}
    yield _sse({"type": "thinking", "step": f"✓ Tìm thấy {len(chunks)} đoạn từ {len(doc_ids)} tài liệu"})
    yield _sse({"type": "thinking", "step": "🧠 Đang tổng hợp câu trả lời..."})

    context_parts = [f"[TÀI LIỆU {chr(65 + i % 26)}]\n{chunk.content}" for i, chunk in enumerate(chunks)]
    merged_context = "\n\n".join(context_parts)

    if check_hallucination(merged_context, retrieval_query):
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    history_block = format_history_block(history)
    qa_prompt = QA_PROMPT.format(context=merged_context, history_block=history_block, question=query)

    full_response = ""
    if settings.THINKING_ENABLED:
        # Thêm directive cấu trúc hóa suy nghĩ vào đầu prompt
        thinking_prompt = _THINKING_DIRECTIVE + qa_prompt
        yield _sse({"type": "thinking", "step": "🧠 Đang phân tích câu hỏi..."})
        yield _sse({"type": "reasoning_start"})
        reasoning_done_sent = False
        for kind, token in stream_llm_invoke_with_thinking(thinking_prompt):
            if kind == "thinking":
                yield _sse({"type": "reasoning", "content": token})
            else:
                # Gửi reasoning_done ngay trước token trả lời đầu tiên
                if not reasoning_done_sent:
                    yield _sse({"type": "reasoning_done"})
                    yield _sse({"type": "thinking", "step": "📖 Đang đọc tài liệu liên quan..."})
                    reasoning_done_sent = True
                full_response += token
                yield _sse({"type": "token", "content": token})
        if not reasoning_done_sent:
            yield _sse({"type": "reasoning_done"})
    else:
        for token in stream_llm_invoke(qa_prompt):
            full_response += token
            yield _sse({"type": "token", "content": token})

    # Post-process
    safe_response = apply_pii_masking(full_response)
    safe_response = re.sub(r'\[\d+\]', '', safe_response)
    safe_response = re.sub(r'\[TÀI LIỆU\s+[A-Z0-9]+\]', '', safe_response).strip()
    log_english_leakage(safe_response)

    # Xử lý LLM citations: gom [A][B] về cuối dòng, map sang [1][2]
    safe_response, citation_source_lines = _process_llm_citations(safe_response, len(chunks))

    # Gửi corrected_text để frontend thay thế text đã stream bằng bản có citation
    yield _sse({"type": "corrected_text", "content": safe_response})

    chunk_queries = [query] * len(chunks)
    for chunk_idx, src_lines in citation_source_lines.items():
        if 0 <= chunk_idx < len(chunks):
            chunk_queries[chunk_idx] = " ".join(src_lines)

    all_relevant_spans = _extract_relevant_spans_dynamic(chunk_queries, chunks)

    citations = []
    for i, chunk in enumerate(chunks):
        citations.append({
            "content_preview": chunk.content,
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "page": chunk.chunk_index + 1,
            "sourceFile": chunk.page_metadata.get("source", f"Tài liệu {chunk.document_id}"),
            "rerank_score": round(chunk.rerank_score, 4),
            "source_type": chunk.source_type,
            "relevant_spans": all_relevant_spans[i] if i < len(all_relevant_spans) else [],
            "source_lines": citation_source_lines.get(i, []),
        })

    # Yield done immediately — không đợi suggestions để tránh delay 4-5s
    yield _sse({"type": "done", "citations": citations, "suggestions": []})
    # Sinh suggestions sau, gửi qua event riêng
    suggestions = _generate_suggestions(merged_context, safe_response)
    if suggestions:
        yield _sse({"type": "suggestions", "suggestions": suggestions})
