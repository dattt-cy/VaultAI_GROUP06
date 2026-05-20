import re
import json
from typing import Generator
from sqlalchemy.orm import Session
from .hybrid_retriever import (
    hybrid_retrieve,
    hybrid_retrieve_multi,
    _retrieval_is_confident,
    get_reranker,
    retrieve_for_summary,
)
from .llm_engine import safe_llm_invoke, stream_llm_invoke, stream_llm_invoke_with_thinking, check_hallucination, apply_pii_masking, log_english_leakage
from .context_manager import (
    format_history_block,
    needs_rewrite, rewrite_query,
    expand_query, is_yes_no_query, extract_yes_no_topic,
)
from app.core.config import settings
from app.api.routes.admin_rag_config import get_top_k


def _build_context_parts(chunks: list) -> list[str]:
    """
    Ghép các chunk liên tiếp (cùng document, chunk_index liền nhau) thành 1 block.
    Giúp LLM thấy nội dung liên tục thay vì nhiều tài liệu rời rạc.
    """
    if not chunks:
        return []

    # Sắp xếp theo (document_id, chunk_index) để nhóm dễ hơn
    ordered = sorted(chunks, key=lambda c: (c.document_id, c.chunk_index))

    groups: list[list] = []
    current_group = [ordered[0]]
    for c in ordered[1:]:
        prev = current_group[-1]
        if c.document_id == prev.document_id and c.chunk_index == prev.chunk_index + 1:
            current_group.append(c)
        else:
            groups.append(current_group)
            current_group = [c]
    groups.append(current_group)

    parts = []
    letter_idx = 0
    for group in groups:
        letter = chr(65 + (letter_idx % 26))
        letter_idx += 1
        source_name = group[0].page_metadata.get("source", f"Tài liệu {group[0].document_id}")
        merged_text = "\n".join(c.content for c in group)
        parts.append(f"[TÀI LIỆU {letter} — {source_name}]\n{merged_text}")
    return parts
from langchain_core.prompts import PromptTemplate


# ---------------------------------------------------------------------------
# Prompt QA — cấu trúc 3 bước bắt buộc để AI suy luận rõ ràng hơn
# {history_block} = "" khi không có history (không ảnh hưởng prompt)
# ---------------------------------------------------------------------------

_SUMMARY_KEYWORDS = [
    "tóm tắt", "tổng hợp", "tổng quan", "tóm lược", "tóm gọn",
    "nội dung chính", "ý chính", "điểm chính", "khái quát",
    "summarize", "summary", "overview",
]

_TABLE_KEYWORDS = [
    "lập bảng", "tạo bảng", "liệt kê", "danh sách", "thống kê",
    "bảng tổng hợp", "bảng so sánh", "liệt kê tất cả", "danh sách tất cả",
    "bảng danh sách", "tổng hợp danh sách", "bảng thống kê",
    "list all", "tabulate", "make a table",
]


def _is_summary_intent(query: str) -> bool:
    lower = query.lower()
    return any(k in lower for k in _SUMMARY_KEYWORDS)


def _is_table_intent(query: str) -> bool:
    lower = query.lower()
    return any(k in lower for k in _TABLE_KEYWORDS)


TABLE_EXTRACTION_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Bạn là chuyên gia trích xuất dữ liệu có cấu trúc từ tài liệu nội bộ.

--- NỘI DUNG TÀI LIỆU ---
{context}
--------------------------

Yêu cầu của người dùng: {question}

Nhiệm vụ: Trích xuất tất cả thực thể/mục phù hợp từ tài liệu thành bảng JSON có cấu trúc.

QUY TẮC:
- Chỉ trích xuất thông tin CÓ TRONG tài liệu, không bịa thêm bất kỳ thông tin nào.
- Nếu một ô không có thông tin → điền "—"
- Tự xác định tên cột phù hợp với nội dung và yêu cầu của người dùng.
- Mỗi thực thể riêng biệt là một hàng.
- Tên cột viết ngắn gọn, rõ ràng bằng tiếng Việt.
- Tiêu đề bảng mô tả nội dung bảng trong 5-8 từ.

Trả về ĐÚNG FORMAT JSON sau đây, KHÔNG thêm bất kỳ text giải thích nào:

{{
  "title": "Tiêu đề bảng ngắn gọn",
  "columns": ["Tên cột 1", "Tên cột 2", "Tên cột 3"],
  "rows": [
    ["giá trị 1", "giá trị 2", "giá trị 3"],
    ["giá trị 1", "giá trị 2", "giá trị 3"]
  ]
}}"""
)


def _extract_table_from_llm(context: str, query: str) -> dict | None:
    """
    Gọi LLM với TABLE_EXTRACTION_PROMPT, parse JSON trả về.
    Trả về dict {title, columns, rows} hoặc None nếu thất bại.
    """
    try:
        prompt = TABLE_EXTRACTION_PROMPT.format(context=context, question=query)
        raw = safe_llm_invoke(prompt)
        # Tìm block JSON đầu tiên trong response
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            print(f"[TableExtract] Không tìm thấy JSON trong response")
            return None
        data = json.loads(match.group())
        if not isinstance(data.get("columns"), list) or not isinstance(data.get("rows"), list):
            print(f"[TableExtract] JSON thiếu trường columns/rows")
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


SUMMARY_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Bạn là chuyên gia phân tích tài liệu. Dưới đây là nội dung các đoạn trích từ tài liệu.

--- NỘI DUNG TÀI LIỆU ---
{context}
--------------------------

Nhiệm vụ: {question}

Hãy trả lời câu hỏi và tổng hợp nội dung dựa trên các đoạn trích trên.
Trình bày một cách tự nhiên, rõ ràng, vào thẳng vấn đề. Sử dụng dấu gạch đầu dòng (-) nếu cần liệt kê nhiều ý để dễ đọc.

Chỉ dùng thông tin từ các đoạn trích. Không bịa thêm. Viết hoàn toàn bằng tiếng Việt.

Tóm tắt:"""
)


QA_PROMPT = PromptTemplate(
    input_variables=["context", "history_block", "question"],
    template="""Bạn là chuyên gia phân tích tài liệu nội bộ. Đọc KỸ LƯỠNG tất cả các đoạn tài liệu trong NGỮ CẢNH trước khi trả lời. Chỉ dùng thông tin từ NGỮ CẢNH bên dưới. Không bịa thêm bất kỳ thông tin nào.

--- NGỮ CẢNH ---
{context}
-----------------

{history_block}
Câu hỏi: {question}

QUY TẮC:
- TUYỆT ĐỐI không bắt đầu bằng "Q:", "A:", "Câu hỏi:", "Trả lời:" — viết thẳng nội dung.
- CHỈ TRẢ LỜI ĐÚNG NHỮNG GÌ ĐƯỢC HỎI. Nếu câu hỏi hỏi về X, chỉ trả lời về X — không tự thêm thông tin về Y, Z dù chúng xuất hiện trong tài liệu gần đó.
- DANH SÁCH ĐẦY ĐỦ: Nếu NGỮ CẢNH chứa nhiều mục/điểm liên quan đến câu hỏi (dù có đánh số hay không, dù là bullet hay đoạn văn riêng biệt), PHẢI liệt kê TẤT CẢ — không được bỏ sót, không được gộp, không được viết "..." hay "và các mục khác". Ví dụ: câu hỏi về "nội dung hợp đồng" và tài liệu liệt kê 9 điểm → phải trả lời đủ 9 điểm.
- ƯU TIÊN SỬ DỤNG suy luận logic: Nếu NGỮ CẢNH đề cập đến chủ đề liên quan (dù dùng từ ngữ khác nhau), hãy suy luận và trả lời. Ví dụ: tài liệu nói "IT thực hiện backup" → có thể trả lời "IT chịu trách nhiệm khôi phục".
- SUY LUẬN DANH SÁCH ĐÓNG: Nếu NGỮ CẢNH liệt kê rõ những gì được phép/khuyến nghị (VD: "chỉ dùng A hoặc B"), và câu hỏi hỏi về X không có trong danh sách đó → kết luận dứt khoát "Không được phép" và giải thích chỉ A, B mới được phép. KHÔNG được nói "không đề cập trong tài liệu" khi đã có danh sách rõ ràng.
- Chỉ từ chối khi NGỮ CẢNH HOÀN TOÀN KHÔNG ĐỀ CẬP đến chủ đề câu hỏi. Nếu có thông tin liên quan dù gián tiếp, hãy trả lời và giải thích suy luận.
- Nếu ngữ cảnh THỰC SỰ KHÔNG CÓ thông tin liên quan → chỉ viết duy nhất: "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp." KHÔNG được viết câu này kèm với nội dung trả lời khác.
- Chọn định dạng phù hợp với độ phức tạp của câu trả lời:
  - **1 ý đơn giản** → viết thành 1-2 câu tự nhiên, KHÔNG dùng bullet. Ví dụ: "Độ dài tối thiểu của mật khẩu là **12 ký tự**. [A]"
  - **Nhiều ý / quy trình / danh sách** → dùng bullet (-), bôi đậm (**...**) số tiền/ngưỡng/mốc thời gian, nội dung con thụt 2 dấu cách "  -"
- Nhãn nguồn [A]/[B]/[C]: đặt DUY NHẤT một nhãn ở cuối câu hoặc cuối dòng bullet, không xếp chồng [A][B][C]

VÍ DỤ — câu trả lời nhiều ý:
Quy trình thanh toán gồm các bước sau:
- **Bước 1: Lập đề nghị thanh toán**
  - Điền phiếu đề nghị trên hệ thống ERP
  - Đính kèm hóa đơn VAT hợp lệ, hợp đồng liên quan [A]
- **Bước 2: Kiểm tra chứng từ**
  - Kế toán xác nhận tính hợp lệ theo Nghị định 123/2020 [A]
- **Chi tiêu khẩn cấp**: hạn mức tối đa **10.000.000 đồng/lần**, bổ sung chứng từ trong **3 ngày làm việc**. [B]

"""
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


def _verify_citations_post_hoc(
    response: str,
    chunks: list,
    threshold: float = -1.5,
) -> tuple[str, dict, list[list[str]]]:
    """
    Xác minh citation bằng cách rerank từng câu/bullet trong response với tất cả chunks.

    Thay vì tin LLM tự gắn [A][B][C], hàm này:
    1. Tách response thành các đơn vị có nghĩa (câu / dòng bullet)
    2. Rerank từng đơn vị với tất cả chunks → chunk có score cao nhất = nguồn thực sự
    3. Chỉ gán citation khi score vượt threshold (tránh gán sai cho câu chuyển tiếp)
    4. Trả về response đã gắn [1][2], citation_source_lines, và relevant_spans

    Fallback: nếu reranker không available, trả về response gốc không thay đổi.
    """
    try:
        reranker = get_reranker()
        if not reranker:
            return response, {}, [[] for _ in chunks]
    except Exception:
        return response, {}, [[] for _ in chunks]

    # Tách response thành các đơn vị: dòng bullet hoặc câu trong đoạn văn
    raw_lines = response.split('\n')
    units: list[tuple[int, str, str]] = []  # (line_idx, line_raw, text_to_score)

    for idx, line in enumerate(raw_lines):
        stripped = line.strip()
        if not stripped:
            continue
        # Với bullet, score cả dòng; với đoạn văn dài, tách theo dấu câu
        if re.match(r'^[-*•]\s+', stripped) or re.match(r'^\d+[\.\)]\s+', stripped):
            text = re.sub(r'^[-*•\d\.\)]+\s*', '', stripped)
            text = re.sub(r'\s*\[\d+\]\s*$', '', text).strip()
            if len(text) > 10:
                units.append((idx, line, text))
        else:
            # Tách câu trong đoạn văn thường
            sentences = re.split(r'(?<=[.!?])\s+', stripped)
            for sent in sentences:
                clean = re.sub(r'\s*\[\d+\]\s*', '', sent).strip()
                if len(clean) > 15:
                    units.append((idx, line, clean))

    if not units or not chunks:
        return response, {}, [[] for _ in chunks]

    # Build pairs: mỗi unit × mỗi chunk
    all_pairs = []
    for _, _, text in units:
        for chunk in chunks:
            all_pairs.append([text, chunk.content])

    try:
        all_scores = reranker.predict(all_pairs)
    except Exception as e:
        print(f"[PostHocCite ERROR] {e}")
        return response, {}, [[] for _ in chunks]

    num_chunks = len(chunks)
    # Map line_idx → best chunk_idx
    line_to_chunk: dict[int, int] = {}
    citation_source_lines: dict[int, list[str]] = {}

    for i, (line_idx, _, text) in enumerate(units):
        scores = all_scores[i * num_chunks: (i + 1) * num_chunks]
        scores_list = scores.tolist() if hasattr(scores, 'tolist') else list(scores)
        best_idx = int(max(range(num_chunks), key=lambda j: scores_list[j]))
        best_score = scores_list[best_idx]
        if best_score >= threshold:
            # Nếu dòng này đã có chunk được gán, dùng chunk có score cao hơn
            if line_idx not in line_to_chunk or scores_list[line_to_chunk[line_idx]] < best_score:
                line_to_chunk[line_idx] = best_idx
            citation_source_lines.setdefault(best_idx, []).append(text)

    # Xây dựng tập chunk nào thực sự được cite (theo thứ tự xuất hiện)
    used_chunk_indices = []
    for idx in sorted(line_to_chunk.keys()):
        c = line_to_chunk[idx]
        if c not in used_chunk_indices:
            used_chunk_indices.append(c)

    # Map chunk_idx gốc → số thứ tự hiển thị [1],[2],...
    chunk_to_display: dict[int, int] = {c: n + 1 for n, c in enumerate(used_chunk_indices)}

    # Rebuild response: thêm [N] vào cuối mỗi dòng bullet hoặc câu cuối đoạn
    result_lines = list(raw_lines)
    line_done: set[int] = set()

    for idx, line_raw, _ in units:
        if idx in line_to_chunk and idx not in line_done:
            c_idx = line_to_chunk[idx]
            display_n = chunk_to_display[c_idx]
            clean_line = re.sub(r'\s*\[\d+\]\s*$', '', result_lines[idx]).rstrip()
            result_lines[idx] = f"{clean_line} [{display_n}]"
            line_done.add(idx)

    new_response = '\n'.join(result_lines)

    # Tính relevant_spans cho từng chunk được cite
    relevant_spans: list[list[str]] = [[] for _ in chunks]
    for c_idx, src_lines in citation_source_lines.items():
        query_text = " ".join(src_lines[:3])
        chunk = chunks[c_idx]
        chunk_sentences = [
            s.strip() for s in re.split(r'(?<=[.!?\n])\s+', chunk.content)
            if len(s.strip()) > 15
        ]
        if not chunk_sentences:
            continue
        pairs = [[query_text, s] for s in chunk_sentences]
        try:
            span_scores = reranker.predict(pairs)
            span_list = span_scores.tolist() if hasattr(span_scores, 'tolist') else list(span_scores)
            scored = sorted(zip(span_list, chunk_sentences), key=lambda x: x[0], reverse=True)
            relevant_spans[c_idx] = [s for score, s in scored if score > -2.0][:3]
        except Exception:
            pass

    return new_response, citation_source_lines, relevant_spans, used_chunk_indices


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

        if markers:
            if clean:
                # Chọn marker xuất hiện nhiều nhất (hoặc đầu tiên nếu bằng nhau)
                best_letter = max(set(markers), key=markers.count)
                chunk_idx = ord(best_letter) - 65  # A→0, B→1, C→2 ...
                if 0 <= chunk_idx < num_chunks:
                    result_lines.append(f"{clean} [{chunk_idx + 1}]")
                    citation_source_lines.setdefault(chunk_idx, []).append(clean)
                else:
                    result_lines.append(clean)  # chunk index ngoài range → giữ text, bỏ marker
            # Dòng chỉ có markers (clean rỗng) → bỏ hoàn toàn
            continue

        # Dòng không có citation marker → giữ nguyên
        result_lines.append(line)

    return '\n'.join(result_lines), citation_source_lines


_NOT_FOUND_PATTERN = re.compile(
    r'Tôi không tìm thấy thông tin này trong tài liệu[^\n]*',
    re.IGNORECASE,
)


def _strip_spurious_not_found(text: str) -> str:
    """
    Xóa câu 'Tôi không tìm thấy...' nếu response đã có nội dung thực sự.
    Qwen2.5 hay thêm câu này như closing statement dù đã trả lời đầy đủ.
    Chỉ giữ lại câu này nếu nó là NỘI DUNG DUY NHẤT của response.
    """
    stripped = _NOT_FOUND_PATTERN.sub('', text).strip()
    # Nếu sau khi xóa còn lại nội dung có nghĩa → dùng bản đã xóa
    if len(stripped) > 20:
        return stripped
    # Nếu xóa xong không còn gì → response thực sự là "không tìm thấy", giữ nguyên
    return text.strip()


def _fix_bullet_indentation(text: str) -> str:
    """
    Post-processing: tự động thụt lề sub-bullet dưới header bold.

    Chuyển đổi:
      - **Bước 1: Header**
      - Nội dung con [1]
      - **Bước 2: Header**

    Thành:
      - **Bước 1: Header**
        - Nội dung con [1]
      - **Bước 2: Header**
    """
    lines = text.split('\n')
    result = []
    under_bold = False

    for line in lines:
        is_root_bullet = bool(re.match(r'^[-*] ', line))
        is_bold_bullet = is_root_bullet and bool(re.match(r'^[-*] \*\*', line))

        if is_bold_bullet:
            under_bold = True
            result.append(line)
        elif under_bold and is_root_bullet:
            # Plain root bullet ngay sau bold header → thụt vào làm sub-item
            result.append('  ' + line)
            # Không reset under_bold: nhiều sub-items liên tiếp vẫn thụt
        else:
            # Blank line hoặc dòng text thường (không phải bullet) → reset
            if line.strip() == '' or not is_root_bullet:
                under_bold = False
            result.append(line)

    return '\n'.join(result)


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
    top_k = get_top_k(db)

    # 0. Query rewriting: rewrite bằng history trước, sau đó áp yes/no extraction
    retrieval_query = query
    if history and needs_rewrite(query, history):
        # Rewrite với context hội thoại để câu hỏi mơ hồ có đầy đủ thông tin
        retrieval_query = rewrite_query(query, history, safe_llm_invoke)
        if retrieval_query != query:
            print(f"[QueryRewrite] '{query}' → '{retrieval_query}'")
    if is_yes_no_query(retrieval_query):
        # Trích topic từ câu hỏi Yes/No để retrieval match keyword tốt hơn
        retrieval_query = extract_yes_no_topic(retrieval_query)
        print(f"[YesNoExtract] → '{retrieval_query}'")

    # 1. Retrieval — table/summary dùng retrieve_for_summary để lấy nhiều chunk hơn
    is_table = _is_table_intent(query)
    if _is_summary_intent(query) or is_table:
        chunks = retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=15)
    else:
        chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
        # Câu hỏi Yes/No luôn expand để tìm quy định liên quan dù retrieval có vẻ confident
        if not _retrieval_is_confident(chunks) or is_yes_no_query(query):
            print(f"[AdaptiveRAG] Confidence thấp, thử expand query...")
            expanded = expand_query(retrieval_query, safe_llm_invoke)
            if len(expanded) > 1:
                multi_chunks = hybrid_retrieve_multi(db=db, queries=expanded, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
                if multi_chunks:
                    # Merge thay vì replace để không mất chunks tốt từ lần đầu
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
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu nội bộ.",
            "citations": [],
            "suggestions": []
        }

    # 2. Ghép ngữ cảnh — chunk liên tiếp cùng doc được merge thành 1 block
    context_parts = _build_context_parts(chunks)
    merged_context = "\n\n".join(context_parts)

    # 3. Anti-hallucination check TRƯỚC KHI GỌI LLM (bỏ qua khi tóm tắt/bảng vì context luôn có nội dung)
    if not _is_summary_intent(query) and not is_table and check_hallucination(merged_context, retrieval_query):
        return {
            "answer": "Tôi không tìm thấy thông tin này trong tài liệu hoặc câu hỏi không liên quan đến dữ liệu hệ thống.",
            "citations": [],
            "suggestions": []
        }

    # 4a. Table extraction — bypass QA pipeline, trích xuất JSON thành bảng
    if is_table:
        table_data = _extract_table_from_llm(merged_context, query)
        if table_data:
            row_count = len(table_data["rows"])
            answer = f"Đã trích xuất **{row_count} mục** từ tài liệu nội bộ."
            suggestions = _generate_suggestions(merged_context, answer)
            return {
                "answer": answer,
                "citations": [],
                "suggestions": suggestions,
                "table_data": table_data,
            }
        # Fallback về QA thường nếu extraction thất bại
        print("[TableExtract] Thất bại, fallback về QA thường")

    # 4b. Gọi LLM — dùng SUMMARY_PROMPT cho yêu cầu tóm tắt để tránh LLM trigger "không tìm thấy"
    if _is_summary_intent(query):
        prompt = SUMMARY_PROMPT.format(context=merged_context, question=query)
    else:
        history_block = format_history_block(history)
        prompt = QA_PROMPT.format(context=merged_context, history_block=history_block, question=query)
    raw_response = safe_llm_invoke(prompt)
    safe_response = apply_pii_masking(raw_response)
    log_english_leakage(safe_response)

    # 5. Xóa context labels thừa + marker [A][B][C] thô + câu "không tìm thấy" giả
    safe_response = re.sub(r'\[TÀI LIỆU\s+[A-Z0-9]+(?:\s*—[^\]]+)?\]', '', safe_response).strip()
    safe_response = re.sub(r'\[[A-Z]\]', '', safe_response).strip()
    safe_response = _strip_spurious_not_found(safe_response)

    # 6. Post-hoc citation verification — rerank từng câu với chunk thực tế
    safe_response, citation_source_lines, all_relevant_spans, used_chunk_indices = \
        _verify_citations_post_hoc(safe_response, chunks)
    safe_response = _fix_bullet_indentation(safe_response)

    # 7. Đóng gói citations — chỉ include chunk được cite thực sự
    citations = []
    for display_n, c_idx in enumerate(used_chunk_indices):
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
    top_k = get_top_k(db)

    # 0. Query rewriting: rewrite bằng history trước, sau đó áp yes/no extraction
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

    is_table = _is_table_intent(query)
    if _is_summary_intent(query):
        yield _sse({"type": "thinking", "step": "📄 Đang đọc toàn bộ nội dung tài liệu để tóm tắt..."})
        chunks = retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=15)
    elif is_table:
        yield _sse({"type": "thinking", "step": "📋 Đang quét tài liệu để trích xuất dữ liệu bảng..."})
        chunks = retrieve_for_summary(db=db, allowed_doc_ids=allowed_doc_ids, max_chunks=15)
    else:
        yield _sse({"type": "thinking", "step": "🔍 Đang tìm kiếm tài liệu liên quan..."})
        chunks = hybrid_retrieve(db=db, query=retrieval_query, top_k=top_k, allowed_doc_ids=allowed_doc_ids)
        if not _retrieval_is_confident(chunks) or is_yes_no_query(query):
            yield _sse({"type": "thinking", "step": "🔄 Đang mở rộng câu hỏi để tìm kiếm sâu hơn..."})
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
    yield _sse({"type": "thinking", "step": "🧠 Đang tổng hợp câu trả lời..."})

    context_parts = _build_context_parts(chunks)
    merged_context = "\n\n".join(context_parts)

    if not _is_summary_intent(query) and not is_table and check_hallucination(merged_context, retrieval_query):
        yield _sse({"type": "done", "citations": [], "suggestions": []})
        return

    # Table extraction branch — không stream token, yield table event
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
        # Fallback về QA nếu extraction thất bại
        print("[TableExtract] Thất bại, fallback về QA stream")

    if _is_summary_intent(query):
        qa_prompt = SUMMARY_PROMPT.format(context=merged_context, question=query)
    else:
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
    safe_response = re.sub(r'\[TÀI LIỆU\s+[A-Z0-9]+(?:\s*—[^\]]+)?\]', '', safe_response).strip()
    safe_response = re.sub(r'\[[A-Z]\]', '', safe_response).strip()
    safe_response = _strip_spurious_not_found(safe_response)
    log_english_leakage(safe_response)

    # Post-hoc citation verification — rerank từng câu với chunk thực tế
    safe_response, citation_source_lines, all_relevant_spans, used_chunk_indices = \
        _verify_citations_post_hoc(safe_response, chunks)
    safe_response = _fix_bullet_indentation(safe_response)

    # Gửi corrected_text để frontend thay thế text đã stream bằng bản có citation
    yield _sse({"type": "corrected_text", "content": safe_response})

    # Build citations — chỉ include chunk được cite thực sự
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

    yield _sse({"type": "done", "citations": citations, "suggestions": []})

    # _generate_suggestions tắt: thêm 1 LLM call sau done → Ollama bận, request tiếp bị queue
