import json
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Generator

from sqlalchemy.orm import Session

from .hybrid_retriever import (
    hybrid_retrieve,
    hybrid_retrieve_multi,
    _retrieval_is_confident,
    get_reranker,
    retrieve_for_summary,
)
from .llm_engine import (
    apply_pii_masking,
    check_hallucination,
    check_response_grounding,
    fast_llm_invoke,
    log_english_leakage,
    safe_llm_invoke,
    stream_llm_invoke,
    stream_llm_invoke_with_thinking,
    trim_to_token_budget,
)
from .context_manager import (
    extract_yes_no_topic,
    format_history_block,
    is_yes_no_query,
    needs_rewrite,
    rewrite_query,
)
from .rag_prompts import (
    COMPARISON_PROMPT,
    HEADING_PROMPT,
    QA_PROMPT,
    SUGGESTIONS_PROMPT,
    SUMMARY_PROMPT,
    TABLE_EXTRACTION_PROMPT,
    THINKING_DIRECTIVE,
    get_intent_instruction,
    is_comparison_intent,
    is_condition_intent,
    is_enumeration_intent,
    is_heading_intent,
    is_heading_top_only,
    is_locating_intent,
    is_summary_intent,
    is_table_intent,
)
from .rag_postprocess import (
    fix_bullet_indentation,
    fix_missing_doc_name,
    strip_citation_block,
    strip_inline_article_refs,
    strip_nguon_blocks,
    strip_question_echo,
    strip_spurious_not_found,
    strip_standalone_article_headings,
    strip_tai_lieu_labels,
    verify_citations_post_hoc,
)
from app.core.config import settings
from app.api.routes.admin_rag_config import get_top_k
from app.services.config_loader import get_active_system_prompt, get_active_llm_options

_MAX_CONTEXT_TOKENS = 3500

_INTENT_INTRO_KEYWORDS = [
    "bạn có thể làm",
    "chức năng của",
    "khả năng của",
    "bạn làm được gì",
    "bạn là ai",
    "giới thiệu bản thân",
    "hệ thống làm được gì",
    "làm được những gì",
]

# Các tin nhắn chào hỏi / smalltalk ngắn không cần RAG
_GREETING_PATTERNS = re.compile(
    r"^\s*(hi|hello|hey|xin chào|chào|chào bạn|alo|ờ|uh|uhm|ok|okay|cảm ơn|cảm on|thanks?|thank you|tốt|được rồi|được|👋)\W*$",
    re.IGNORECASE | re.UNICODE,
)

_GREETING_REPLY = "Xin chào! Tôi có thể giúp gì cho bạn? Hãy đặt câu hỏi về tài liệu nội bộ."


def _is_greeting(query: str) -> bool:
    """Trả về True nếu query là lời chào/smalltalk ngắn, không cần tra tài liệu."""
    return bool(_GREETING_PATTERNS.match(query.strip()))

_INTRO_ANSWER = (
    "Xin chào! Tôi là **Trợ lý AI Nội bộ (Local AI)** – Hệ thống trí tuệ nhân tạo chuyên biệt được thiết kế để quản lý và khai thác tri thức của doanh nghiệp một cách bảo mật.\n\n"
    "Dưới đây là các tính năng cốt lõi tôi có thể hỗ trợ bạn:\n\n"
    "* **🔍 Tìm Kiếm Ngữ Nghĩa (Hybrid Search):** Quét và hiểu ý nghĩa của hàng vạn trang tài liệu (PDF, Word, TXT) chỉ trong vài giây, thay vì chỉ tìm theo từ khóa thô cứng.\n"
    "* **🧠 Hỏi Đáp Tập Trung (RAG):** Đọc nội dung tài liệu của bạn, phân tích để chắt lọc câu trả lời chính xác nhất, sau đó trình bày lại bằng ngôn ngữ tự nhiên.\n"
    "* **📑 Trích Dẫn Cụ Thể, Minh Bạch:** Mọi thông tin tôi cung cấp bắt buộc phải có nguồn gốc rõ ràng (Tên file, Số trang, Đoạn văn) để bạn dễ dàng kiểm chứng lại chống \"ảo giác\".\n"
    "* **🛡️ Bảo Mật Tuyệt Đối (Air-gapped):** Mọi quá trình suy luận của tôi diễn ra 100% trên phần cứng máy chủ nội bộ (Offline). Dữ liệu nhạy cảm của bạn sẽ không bao giờ bị đưa ra ngoài Internet.\n\n"
    "Bạn đã sẵn sàng chưa? Hãy thử đặt bất kỳ câu hỏi nào liên quan đến các tài liệu đang có trên hệ thống!"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_context_parts(chunks: list) -> list[str]:
    """Ghép chunk theo tài liệu — mỗi document_id nhận 1 chữ cái duy nhất.
    Các chunk không liên tiếp trong cùng tài liệu được nối bằng dấu phân cách.
    """
    if not chunks:
        return []

    # Xác định thứ tự xuất hiện của từng document_id (giữ nguyên thứ tự retrieval)
    doc_order: dict[int, int] = {}
    for c in chunks:
        if c.document_id not in doc_order:
            doc_order[c.document_id] = len(doc_order)

    # Gom tất cả chunks theo document_id, sort theo chunk_index
    doc_chunks: dict[int, list] = {}
    for c in chunks:
        doc_chunks.setdefault(c.document_id, []).append(c)
    for doc_id in doc_chunks:
        doc_chunks[doc_id].sort(key=lambda c: c.chunk_index)

    parts = []
    for doc_id, letter_idx in sorted(doc_order.items(), key=lambda x: x[1]):
        letter = chr(65 + (letter_idx % 26))
        cs = doc_chunks[doc_id]
        source_name = cs[0].page_metadata.get("source", f"Tài liệu {doc_id}")

        # Ghép các đoạn liên tiếp; chèn "..." giữa các đoạn không liền nhau
        segments = []
        current_seg = [cs[0]]
        for c in cs[1:]:
            if c.chunk_index == current_seg[-1].chunk_index + 1:
                current_seg.append(c)
            else:
                segments.append(current_seg)
                current_seg = [c]
        segments.append(current_seg)

        merged_text = "\n[...]\n".join(
            "\n".join(ch.content for ch in seg) for seg in segments
        )
        parts.append(f"[TÀI LIỆU {letter} — {source_name}]\n{merged_text}")
    return parts


def _detect_article_ambiguity(query: str, chunks: list) -> list[dict] | None:
    """
    Kiểm tra xem query có hỏi về một điều khoản cụ thể (VD: "điều 4") mà
    xuất hiện trong nhiều ngữ cảnh khác nhau.
    Trả về list các văn bản nếu mơ hồ, None nếu không.
    """
    match = re.search(r'điều\s+(\d+)', query, re.IGNORECASE)
    if not match:
        return None
    article_num = match.group(1)
    article_heading = re.compile(rf'(?:^|\n)\s*[Đđ]iều\s+{article_num}[\.\s]', re.MULTILINE)

    tt_pattern = re.compile(
        r'(?:Thông tư|Quyết định|Nghị định)\s+(?:số\s+)?(\d+[\/\-]\d+[\/\-][A-Z\-]+)',
        re.IGNORECASE,
    )

    by_doc: dict[int, str] = {}
    for chunk in chunks:
        if article_heading.search(chunk.content):
            doc_id = chunk.document_id
            if doc_id not in by_doc:
                by_doc[doc_id] = chunk.page_metadata.get("source", f"Tài liệu {doc_id}")

    if len(by_doc) >= 2:
        return [{"document_id": doc_id, "name": name} for doc_id, name in by_doc.items()]

    seen_tt: dict[str, str] = {}
    for chunk in chunks:
        if not article_heading.search(chunk.content):
            continue
        for full_match in tt_pattern.finditer(chunk.content):
            code = full_match.group(1).upper().strip()
            if code not in seen_tt:
                seen_tt[code] = full_match.group(0).strip()

    unique_labels = list(dict.fromkeys(seen_tt.values()))
    if len(unique_labels) >= 2:
        return [{"document_id": None, "name": label} for label in unique_labels]

    return None


def _extract_table_from_llm(context: str, query: str) -> dict | None:
    """Gọi LLM với TABLE_EXTRACTION_PROMPT, parse JSON trả về."""
    try:
        prompt = TABLE_EXTRACTION_PROMPT.format(context=context, question=query)
        raw = safe_llm_invoke(prompt)
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            print("[TableExtract] Không tìm thấy JSON trong response")
            return None
        data = json.loads(match.group())
        if not isinstance(data.get("columns"), list) or not isinstance(data.get("rows"), list):
            print("[TableExtract] JSON thiếu trường columns/rows")
            return None
        if not data["columns"] or not data["rows"]:
            return None
        return {
            "title": data.get("title", "Bảng dữ liệu"),
            "columns": data["columns"],
            "rows": data["rows"],
        }
    except json.JSONDecodeError as e:
        print(f"[TableExtract JSON ERROR] {e}")
        return None
    except Exception as e:
        print(f"[TableExtract ERROR] {e}")
        return None


def _generate_suggestions(context: str, answer: str) -> list:
    """Sinh 3 câu hỏi gợi ý tiếp theo. Trả về [] nếu lỗi."""
    try:
        prompt = SUGGESTIONS_PROMPT.format(context=context[:2000], answer=answer[:500])
        raw = fast_llm_invoke(prompt, num_predict=150)
        lines = []
        for line in raw.strip().splitlines():
            line = line.strip()
            match = re.match(r'^(\d+)[\.\)]\s*(.+)$', line)
            if match:
                q = match.group(2).strip().replace('**', '').replace('*', '')
                if q and len(q) > 5:
                    lines.append(q)
            if len(lines) == 3:
                break
        return lines[:3]
    except Exception as e:
        print(f"[Suggestions ERROR] {e}")
        return []


def _clean_response(text: str) -> str:
    """Xóa context labels, file markers, câu 'không tìm thấy' thừa."""
    text = re.sub(r'\[TÀI LIỆU\s+[A-Z0-9]+(?:\s*—[^\]]+)?\]', '', text).strip()
    text = re.sub(r'\[[A-Z]\]', '', text).strip()
    text = re.sub(r'\[[^\]]*\.(txt|pdf|docx?|xlsx?)\]', '', text, flags=re.IGNORECASE).strip()
    text = re.sub(r'\bTài liệu\s+[A-Z]\s*[—–-]\s*', '', text).strip()
    text = re.sub(r'\b(\w[\w\-().,]+)\.(txt|pdf|docx?|xlsx?)\b\.?', r'\1', text, flags=re.IGNORECASE)
    # Fix ** opening có space thừa: "** text" → "**text" (chỉ khi ** ở đầu, trước là space/newline)
    text = re.sub(r'(?:(?<=\s)|(?<=^))\*\*\s+(?=\S)', '**', text, flags=re.MULTILINE)
    # Fix ** closing có space thừa trước dấu đóng: "text . **" → "text.**"
    text = re.sub(r'(?<=\w)\s+\*\*(?=[\s\n.,;:!?]|$)', '**', text, flags=re.MULTILINE)
    # Fix ** closing dính liền với mục tiếp theo: "ĐÍCH** 2." → "ĐÍCH**\n2."
    text = re.sub(r'\*\*\s+(?=\d+[\.、])', '**\n', text)
    # Fix bullet dính liền nhau sau dấu câu: "text.-Bước" → "text.\n-Bước"
    text = re.sub(r'([.!?])\s*(?=-\s*\*{0,2}[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂẮẶẦẤẨẪẮẶ])', r'\1\n', text)
    # Fix bullet dính sau text: "LƯƠNG- 1.1." → "LƯƠNG\n- 1.1."
    text = re.sub(r'(?<=[^\s\n])-\s+(?=\d+[\.\)])', r'\n- ', text)
    text = re.sub(r'(?<=[^\s\n])-\s+(?=a\)|b\)|c\)|d\))', r'\n- ', text)
    # Fix danh sách đánh số dính liền không có ** bao quanh: "ĐÍCH 2. ĐỐI" → "ĐÍCH\n2. ĐỐI"
    text = re.sub(r'(?<=[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂẮẶẦẤẨẪẮẶA-zđàáâãèéêìíòóôõùúăắặầấẩẫắặ])\s+(\d+\.\s+[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂẮẶẦẤẨẪẮẶ])', r'\n\1', text)
    return strip_spurious_not_found(text)


def _build_citations(chunks: list, used_chunk_indices: list, all_relevant_spans: list, citation_source_lines: dict) -> list:
    citations = []
    for c_idx in used_chunk_indices:
        chunk = chunks[c_idx]
        citations.append({
            "content_preview": chunk.content,
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "page": chunk.page_metadata.get("page_number", chunk.chunk_index + 1),
            "sourceFile": chunk.page_metadata.get("source", f"Tài liệu {chunk.document_id}"),
            "rerank_score": round(chunk.rerank_score, 4),
            "source_type": chunk.source_type,
            "relevant_spans": all_relevant_spans[c_idx] if c_idx < len(all_relevant_spans) else [],
            "source_lines": citation_source_lines.get(c_idx, []),
        })
    return citations


def _do_retrieval(query: str, retrieval_query: str, db: Session, top_k: int, allowed_doc_ids: list | None) -> list:
    """Chạy retrieval, tự động expand nếu confidence thấp hoặc câu hỏi yes/no."""
    is_table = is_table_intent(query)
    if is_summary_intent(query) or is_table:
        return retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=15)

    chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
    if not _retrieval_is_confident(chunks) or is_yes_no_query(query):
        print("[AdaptiveRAG] Confidence thấp, thử expand query...")
        from .context_manager import expand_query
        expanded = expand_query(retrieval_query, safe_llm_invoke)
        if len(expanded) > 1:
            multi_chunks = hybrid_retrieve_multi(db=db, queries=expanded, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
            if multi_chunks:
                seen = {c.vector_id for c in chunks}
                merged = chunks + [c for c in multi_chunks if c.vector_id not in seen]
                reranker = get_reranker()
                if reranker:
                    for c in merged:
                        if c.rerank_score is None:
                            c.rerank_score = reranker.predict([(retrieval_query, c.content)])
                    merged.sort(key=lambda c: c.rerank_score or 0, reverse=True)
                chunks = merged[:top_k]
    return chunks


def _rewrite_query(query: str, history: list) -> str:
    """Rewrite query với history context nếu cần."""
    retrieval_query = query
    if history and needs_rewrite(query, history):
        retrieval_query = rewrite_query(query, history, safe_llm_invoke)
        if retrieval_query != query:
            print(f"[QueryRewrite] '{query}' → '{retrieval_query}'")
    if is_yes_no_query(retrieval_query):
        retrieval_query = extract_yes_no_topic(retrieval_query)
        print(f"[YesNoExtract] → '{retrieval_query}'")
    return retrieval_query


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def query_rag(query: str, db: Session, allowed_doc_ids: list = None,
              conversation_history: list = None):
    """
    Luồng RAG nâng cấp dùng Hybrid Retriever.
    conversation_history: list[dict] từ load_conversation_history() — đã được load sẵn ở chat.py
    """
    if _is_greeting(query):
        return {"answer": _GREETING_REPLY, "citations": [], "suggestions": []}

    lower_query = query.lower()
    if any(k in lower_query for k in _INTENT_INTRO_KEYWORDS):
        return {"answer": _INTRO_ANSWER, "citations": [], "suggestions": []}

    history = conversation_history or []
    top_k = get_top_k(db)
    if is_enumeration_intent(query) or is_condition_intent(query):
        top_k = max(top_k, 20)
    elif is_locating_intent(query):
        top_k = min(top_k, 5)  # Câu hỏi định vị chỉ cần ít chunk
    retrieval_query = _rewrite_query(query, history)

    chunks = _do_retrieval(query, retrieval_query, db, top_k, allowed_doc_ids)

    if not chunks:
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu nội bộ.",
            "citations": [],
            "suggestions": [],
        }

    ambiguous_sources = _detect_article_ambiguity(query, chunks)
    if ambiguous_sources:
        names = "\n".join(f"- {s['name']}" for s in ambiguous_sources)
        return {
            "answer": f"Câu hỏi của bạn đề cập đến một điều khoản xuất hiện trong nhiều văn bản khác nhau:\n{names}\n\nBạn muốn hỏi về điều khoản trong văn bản nào?",
            "citations": [],
            "suggestions": [s['name'] for s in ambiguous_sources],
            "clarify": True,
        }

    context_parts = _build_context_parts(chunks)
    merged_context = "\n\n".join(context_parts)

    skip_hallucination = is_summary_intent(query) or is_table_intent(query) or is_comparison_intent(query)
    if not skip_hallucination and check_hallucination(merged_context, retrieval_query):
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu hoặc câu hỏi không liên quan đến dữ liệu hệ thống.",
            "citations": [],
            "suggestions": [],
        }

    sys_prompt = get_active_system_prompt(db)
    llm_options = get_active_llm_options(db)
    num_ctx = llm_options.get("num_ctx", settings.LLM_NUM_CTX)
    num_predict = llm_options.get("num_predict", settings.LLM_NUM_PREDICT)
    ctx_budget = max(500, num_ctx - num_predict - 400)
    merged_context = trim_to_token_budget(merged_context, ctx_budget)

    if is_table_intent(query):
        table_data = _extract_table_from_llm(merged_context, query)
        if table_data:
            row_count = len(table_data["rows"])
            answer = f"Đã trích xuất **{row_count} mục** từ tài liệu nội bộ."
            return {
                "answer": answer,
                "citations": [],
                "suggestions": _generate_suggestions(merged_context, answer),
                "table_data": table_data,
            }
        print("[TableExtract] Thất bại, fallback về QA thường")

    if is_summary_intent(query):
        prompt = SUMMARY_PROMPT.format(context=merged_context, question=query)
    elif is_comparison_intent(query):
        history_block = format_history_block(history)
        prompt = COMPARISON_PROMPT.format(context=merged_context, history_block=history_block, question=query)
    else:
        history_block = format_history_block(history)
        intent_instruction = get_intent_instruction(query)
        prompt = QA_PROMPT.format(
            context=merged_context,
            history_block=history_block,
            question=query,
            intent_instruction=f"\n{intent_instruction}" if intent_instruction else "",
        )

    raw_response = safe_llm_invoke(prompt, system_prompt=sys_prompt, options_override=llm_options)

    if not is_summary_intent(query) and check_response_grounding(raw_response, chunks):
        return {
            "answer": "Tôi không tìm thấy thông tin đủ tin cậy trong tài liệu để trả lời câu hỏi này.",
            "citations": [],
            "suggestions": [],
        }

    safe_response = apply_pii_masking(raw_response)
    log_english_leakage(safe_response)
    safe_response = _clean_response(safe_response)

    safe_response, citation_source_lines, all_relevant_spans, used_chunk_indices = \
        verify_citations_post_hoc(safe_response, chunks)
    safe_response = fix_bullet_indentation(safe_response)
    safe_response = fix_missing_doc_name(safe_response, chunks)
    safe_response = strip_question_echo(safe_response, query)
    safe_response = strip_citation_block(safe_response)
    safe_response = strip_nguon_blocks(safe_response)
    safe_response = strip_tai_lieu_labels(safe_response)
    safe_response = strip_inline_article_refs(safe_response)
    safe_response = strip_standalone_article_headings(safe_response)

    citations = _build_citations(chunks, used_chunk_indices, all_relevant_spans, citation_source_lines)
    suggestions = _generate_suggestions(merged_context, safe_response)

    return {"answer": safe_response, "citations": citations, "suggestions": suggestions}


def query_rag_stream(query: str, db: Session, allowed_doc_ids: list = None,
                     conversation_history: list = None) -> Generator[str, None, None]:
    """
    Streaming version của query_rag — yield SSE events:
      {"type":"thinking","step":"..."}
      {"type":"token","content":"..."}
      {"type":"done","citations":[...],"suggestions":[...]}
    """
    if _is_greeting(query):
        yield _sse({"type": "token", "content": _GREETING_REPLY})
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    lower_query = query.lower()
    if any(k in lower_query for k in _INTENT_INTRO_KEYWORDS):
        yield _sse({"type": "token", "content": _INTRO_ANSWER})
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    history = conversation_history or []
    top_k = get_top_k(db)
    if is_enumeration_intent(query) or is_condition_intent(query):
        top_k = max(top_k, 20)
    elif is_locating_intent(query):
        top_k = min(top_k, 5)  # Câu hỏi định vị chỉ cần ít chunk

    retrieval_query = query
    if history and needs_rewrite(query, history):
        yield _sse({"type": "thinking", "step": "💬 Đang phân tích ngữ cảnh hội thoại..."})
        retrieval_query = rewrite_query(query, history, safe_llm_invoke)
        if retrieval_query != query:
            print(f"[QueryRewrite] '{query}' → '{retrieval_query}'")
            yield _sse({"type": "thinking", "step": f"🔄 Đã làm rõ câu hỏi: {retrieval_query[:60]}..."})
    if is_yes_no_query(retrieval_query):
        retrieval_query = extract_yes_no_topic(retrieval_query)
        print(f"[YesNoExtract] → '{retrieval_query}'")

    is_table = is_table_intent(query)
    is_comparison = is_comparison_intent(query)
    is_heading = is_heading_intent(query)

    # Heading intent: nếu user chọn nhiều file → hỏi lại file nào
    if is_heading and allowed_doc_ids and len(allowed_doc_ids) > 1:
        from app.models.doc_model import Document
        docs = db.query(Document).filter(Document.id.in_(allowed_doc_ids)).all()
        # Nếu query chứa tên file cụ thể → tự lọc, không hỏi lại
        matched = [d for d in docs if d.title.lower() in query.lower()]
        if matched:
            allowed_doc_ids = [matched[0].id]
        else:
            names = [d.title for d in docs]
            names_md = "\n".join(f"- {n}" for n in names)
            clarify_text = (
                f"Bạn đang chọn **{len(names)} tài liệu**. Bạn muốn xem đề mục của tài liệu nào?\n{names_md}"
            )
            suggestions = [f"{query} của {n}" for n in names]
            yield _sse({"type": "token", "content": clarify_text})
            yield _sse({"type": "suggestions", "suggestions": suggestions})
            yield _sse({"type": "done", "citations": []})
            return

    if is_summary_intent(query):
        yield _sse({"type": "thinking", "step": "📄 Đang đọc toàn bộ nội dung tài liệu để tóm tắt..."})
        chunks = retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=15)
    elif is_heading:
        yield _sse({"type": "thinking", "step": "📑 Đang quét cấu trúc đề mục tài liệu..."})
        chunks = retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=30)
    elif is_table:
        yield _sse({"type": "thinking", "step": "📋 Đang quét tài liệu để trích xuất dữ liệu bảng..."})
        chunks = retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=15)
    elif is_comparison:
        yield _sse({"type": "thinking", "step": "⚖️ Đang tìm kiếm thông tin để so sánh..."})
        chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
    else:
        yield _sse({"type": "thinking", "step": "🔍 Đang tìm kiếm tài liệu liên quan..."})
        chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
        if not _retrieval_is_confident(chunks) or is_yes_no_query(query):
            yield _sse({"type": "thinking", "step": "🔄 Đang mở rộng câu hỏi để tìm kiếm sâu hơn..."})
            from .context_manager import expand_query
            expanded = expand_query(retrieval_query, safe_llm_invoke)
            if len(expanded) > 1:
                multi_chunks = hybrid_retrieve_multi(db=db, queries=expanded, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
                if multi_chunks:
                    seen = {c.vector_id for c in chunks}
                    merged = chunks + [c for c in multi_chunks if c.vector_id not in seen]
                    reranker = get_reranker()
                    if reranker:
                        for c in merged:
                            if c.rerank_score is None:
                                c.rerank_score = reranker.predict([(retrieval_query, c.content)])
                        merged.sort(key=lambda c: c.rerank_score or 0, reverse=True)
                    chunks = merged[:top_k]

    if not chunks:
        yield _sse({"type": "thinking", "step": "⚠️ Không tìm thấy tài liệu phù hợp"})
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    doc_ids = {c.document_id for c in chunks}
    yield _sse({"type": "thinking", "step": f"✓ Tìm thấy {len(chunks)} đoạn từ {len(doc_ids)} tài liệu"})

    ambiguous_sources = _detect_article_ambiguity(query, chunks)
    if ambiguous_sources:
        print(f"[Ambiguity] '{query[:50]}' → {[s['name'] for s in ambiguous_sources]}")
        names_md = "\n".join(f"- {s['name']}" for s in ambiguous_sources)
        clarify_text = (
            f"Câu hỏi của bạn đề cập đến một điều khoản xuất hiện trong **{len(ambiguous_sources)} văn bản** khác nhau:\n"
            f"{names_md}\n\nBạn muốn hỏi về điều khoản trong văn bản nào?"
        )
        yield _sse({"type": "token", "content": clarify_text})
        yield _sse({"type": "suggestions", "data": [s['name'] for s in ambiguous_sources]})
        yield _sse({"type": "done", "citations": []})
        return

    yield _sse({"type": "thinking", "step": "🧠 Đang tổng hợp câu trả lời..."})

    context_parts = _build_context_parts(chunks)
    merged_context = "\n\n".join(context_parts)

    skip_hallucination = is_summary_intent(query) or is_table or is_comparison or is_heading
    if not skip_hallucination and check_hallucination(merged_context, retrieval_query):
        yield _sse({"type": "token", "content": "Tôi không tìm thấy thông tin này trong tài liệu hoặc câu hỏi không liên quan đến dữ liệu hệ thống."})
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    sys_prompt = get_active_system_prompt(db)
    llm_options = get_active_llm_options(db)
    num_ctx = llm_options.get("num_ctx", settings.LLM_NUM_CTX)
    num_predict = llm_options.get("num_predict", settings.LLM_NUM_PREDICT)
    ctx_budget = max(500, num_ctx - num_predict - 400)
    merged_context = trim_to_token_budget(merged_context, ctx_budget)

    if is_table:
        yield _sse({"type": "thinking", "step": "🔢 Đang trích xuất dữ liệu có cấu trúc..."})
        table_data = _extract_table_from_llm(merged_context, query)
        if table_data:
            row_count = len(table_data["rows"])
            answer = f"Đã trích xuất **{row_count} mục** từ tài liệu nội bộ."
            yield _sse({"type": "token", "content": answer})
            yield _sse({"type": "table", "table_data": table_data})
            yield _sse({"type": "done", "citations": [], "suggestions": []})
            return
        print("[TableExtract] Thất bại, fallback về QA stream")

    if is_summary_intent(query):
        qa_prompt = SUMMARY_PROMPT.format(context=merged_context, question=query)
    elif is_heading:
        depth_instruction = (
            "\n7. CHỈ liệt kê đề mục lớn cấp 1 (Phần/Chương/Mục chính). "
            "TUYỆT ĐỐI KHÔNG liệt kê mục con, KHÔNG thêm nội dung, mô tả, ví dụ bên dưới bất kỳ mục nào. "
            "Mỗi dòng chỉ là TÊN đề mục lớn, không có gì thêm."
            if is_heading_top_only(query) else
            "\n7. TUYỆT ĐỐI KHÔNG thêm nội dung, mô tả hay ví dụ bên dưới bất kỳ đề mục nào. Chỉ tên đề mục."
        )
        qa_prompt = HEADING_PROMPT.format(context=merged_context, question=query, depth_instruction=depth_instruction)
    elif is_comparison:
        history_block = format_history_block(history)
        qa_prompt = COMPARISON_PROMPT.format(context=merged_context, history_block=history_block, question=query)
    else:
        history_block = format_history_block(history)
        intent_instruction = get_intent_instruction(query)
        qa_prompt = QA_PROMPT.format(
            context=merged_context,
            history_block=history_block,
            question=query,
            intent_instruction=f"\n{intent_instruction}" if intent_instruction else "",
        )

    full_response = ""
    if settings.THINKING_ENABLED:
        thinking_prompt = THINKING_DIRECTIVE + qa_prompt
        yield _sse({"type": "thinking", "step": "🧠 Đang phân tích câu hỏi..."})
        yield _sse({"type": "reasoning_start"})
        reasoning_done_sent = False
        for kind, token in stream_llm_invoke_with_thinking(thinking_prompt):
            if kind == "thinking":
                yield _sse({"type": "reasoning", "content": token})
            else:
                if not reasoning_done_sent:
                    yield _sse({"type": "reasoning_done"})
                    yield _sse({"type": "thinking", "step": "📖 Đang đọc tài liệu liên quan..."})
                    reasoning_done_sent = True
                full_response += token
                yield _sse({"type": "token", "content": token})
        if not reasoning_done_sent:
            yield _sse({"type": "reasoning_done"})
    else:
        for token in stream_llm_invoke(qa_prompt, system_prompt=sys_prompt, options_override=llm_options):
            full_response += token
            yield _sse({"type": "token", "content": token})

    # Suggestions chạy song song với post-processing
    with ThreadPoolExecutor(max_workers=1) as executor:
        suggestion_future = executor.submit(_generate_suggestions, merged_context, full_response)

        safe_response = apply_pii_masking(full_response)
        safe_response = _clean_response(safe_response)
        log_english_leakage(safe_response)

        if is_heading:
            # Heading: bypass verify_citations, lấy 1 chunk đại diện mỗi document làm citation
            seen_docs: set[int] = set()
            used_chunk_indices = []
            for i, c in enumerate(chunks):
                if c.document_id not in seen_docs:
                    seen_docs.add(c.document_id)
                    used_chunk_indices.append(i)
            citation_source_lines = {}
            all_relevant_spans = [[] for _ in chunks]
        else:
            safe_response, citation_source_lines, all_relevant_spans, used_chunk_indices = \
                verify_citations_post_hoc(safe_response, chunks)

            # Nếu không có chunk nào được cite → response có thể hallucinated
            if not is_summary_intent(query) and not used_chunk_indices and chunks:
                yield _sse({"type": "corrected_text", "content": "Tôi không tìm thấy thông tin đủ tin cậy trong tài liệu để trả lời câu hỏi này."})
                yield _sse({"type": "done", "citations": [], "suggestions": []})
                return

        # Fix numbered list dính nhau (sau citations đã được chèn nếu có)
        safe_response = re.sub(
            r'(?<=[^\n])\s*(?:\[\d+\]\s*)*(\d+[\.]\s+[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂẮẶẦẤẨẪẮẶ])',
            r'\n\1', safe_response
        )
        # Strip orphaned ** còn sót (** đứng một mình đầu dòng)
        safe_response = re.sub(r'^\*{1,2}\s*$', '', safe_response, flags=re.MULTILINE)

        safe_response = fix_bullet_indentation(safe_response)
        safe_response = fix_missing_doc_name(safe_response, chunks)
        safe_response = strip_question_echo(safe_response, query)
        safe_response = strip_citation_block(safe_response)
        safe_response = strip_nguon_blocks(safe_response)
        safe_response = strip_tai_lieu_labels(safe_response)
        safe_response = strip_inline_article_refs(safe_response)
        safe_response = strip_standalone_article_headings(safe_response)

        citations = _build_citations(chunks, used_chunk_indices, all_relevant_spans, citation_source_lines)

        # Emit corrected_text + done ngay — UI unlock, citations + số [1][2] hiện cùng lúc
        yield _sse({"type": "corrected_text", "content": safe_response})
        yield _sse({"type": "done", "citations": citations})

        # Lấy suggestions sau done — hiện ra 2-3s sau
        try:
            suggestions = suggestion_future.result(timeout=15)
        except Exception:
            suggestions = []

    if suggestions:
        yield _sse({"type": "suggestions", "suggestions": suggestions})
