"""Post-processing of LLM responses: citation verification, text cleanup, formatting."""
import re

from .hybrid_retriever import get_reranker

_NOT_FOUND_PATTERN = re.compile(
    r'Tôi không tìm thấy thông tin này trong tài liệu[^\n]*',
    re.IGNORECASE,
)

_MISSING_DOC_NAME_PATTERN = re.compile(
    r'trong tài liệu\s*\.',
    re.IGNORECASE,
)


def strip_spurious_not_found(text: str) -> str:
    """
    Xóa câu 'Tôi không tìm thấy...' nếu response đã có nội dung thực sự.
    Chỉ giữ lại câu này nếu nó là nội dung DUY NHẤT của response.
    """
    stripped = _NOT_FOUND_PATTERN.sub('', text).strip()
    if len(stripped) > 20:
        return stripped
    return text.strip()


def fix_missing_doc_name(text: str, chunks: list) -> str:
    """Thay 'trong tài liệu .' bằng tên file thực từ chunk đầu tiên."""
    if not _MISSING_DOC_NAME_PATTERN.search(text):
        return text
    source_name = next(
        (chunk.page_metadata.get("source", "") for chunk in chunks if chunk.page_metadata.get("source")),
        None,
    )
    if not source_name:
        return text
    return _MISSING_DOC_NAME_PATTERN.sub(f'trong **{source_name}**.', text)


def fix_bullet_indentation(text: str) -> str:
    """
    Tự động thụt lề sub-bullet ngay dưới header bold.
    - **Bước 1: Header**
    - Nội dung con  →  trở thành   - **Bước 1: Header** / (2sp)- Nội dung con
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
            result.append('  ' + line)
        else:
            if line.strip() == '' or not is_root_bullet:
                under_bold = False
            result.append(line)

    return '\n'.join(result)


_DIEU_TAI_LIEU_PATTERN = re.compile(
    r'\(Điều\s+[\d\.]+,\s*Tài liệu\s+[A-Z]\)',
    re.IGNORECASE,
)
_TAI_LIEU_LABEL_PATTERN = re.compile(
    r',?\s*Tài liệu\s+[A-Z](?=\)|\s|$|,)',
    re.IGNORECASE,
)


def strip_tai_lieu_labels(text: str) -> str:
    """Xóa 'Tài liệu X' khỏi câu trả lời — nguồn đã hiển thị qua nhãn [X]."""
    # "(Điều 3, Tài liệu B)" → "(Điều 3)"
    text = _TAI_LIEU_LABEL_PATTERN.sub('', text)
    # Dọn ngoặc trống "()" còn sót lại
    text = re.sub(r'\(\s*\)', '', text)
    return text


_STANDALONE_ARTICLE_HEADING = re.compile(
    r'^\s*(?:Điều|Khoản|Mục|Chương|Phần)\s+[\d\.]+\s*[:\-]?\s*$',
    re.IGNORECASE | re.MULTILINE,
)

# Khớp "(Điều 3)", "(Điều 9.1)", "(Khoản 2)", "(Mục 4.2.1)" trong nội dung câu trả lời.
# Chú ý: chỉ strip khi nằm ở cuối dòng hoặc trước citation [N] — tránh strip tiêu đề đoạn.
_INLINE_ARTICLE_REF = re.compile(
    r'\s*\(\s*(?:Điều|Khoản|Mục|Chương|Phần)\s+[\d\.]+(?:\s*,\s*[\d\.]+)*\s*\)(?=\s*(?:\[\d+\]|$|\n))',
    re.IGNORECASE,
)


def strip_standalone_article_headings(text: str) -> str:
    """Xóa dòng chỉ chứa 'Điều X.X' / 'Khoản X' đứng một mình — không phải nội dung trả lời."""
    return _STANDALONE_ARTICLE_HEADING.sub('', text).strip()


def strip_inline_article_refs(text: str) -> str:
    """Xóa '(Điều X)' / '(Khoản X)' cuối dòng/cuối bullet — citation [N] đã thay thế vai trò này."""
    return _INLINE_ARTICLE_REF.sub('', text)


def process_llm_citations(response: str, num_chunks: int) -> tuple[str, dict]:
    """
    Xử lý response chứa inline citations [A],[B],[C] do LLM tự chèn.
    Gom markers về cuối dòng dưới dạng [N], trả về (response đã format, citation_source_lines).
    """
    lines = response.split('\n')
    result_lines = []
    citation_source_lines: dict[int, list[str]] = {}

    for line in lines:
        markers = re.findall(r'\[([A-Z])\]', line)
        clean = re.sub(r'\s*\[([A-Z])\]\s*', ' ', line)
        clean = re.sub(r'\s+', ' ', clean).strip()

        if markers:
            if clean:
                best_letter = max(set(markers), key=markers.count)
                chunk_idx = ord(best_letter) - 65
                if 0 <= chunk_idx < num_chunks:
                    result_lines.append(f"{clean} [{chunk_idx + 1}]")
                    citation_source_lines.setdefault(chunk_idx, []).append(clean)
                else:
                    result_lines.append(clean)
            continue

        result_lines.append(line)

    return '\n'.join(result_lines), citation_source_lines


def verify_citations_post_hoc(
    response: str,
    chunks: list,
    threshold: float = -1.5,
) -> tuple[str, dict, list[list[str]], list[int]]:
    """
    Xác minh citation bằng cách rerank từng câu/bullet trong response với tất cả chunks.

    Thay vì tin LLM tự gắn [A][B][C], hàm này:
    1. Tách response thành các đơn vị có nghĩa (câu / dòng bullet)
    2. Rerank từng đơn vị với tất cả chunks → chunk có score cao nhất = nguồn thực sự
    3. Chỉ gán citation khi score vượt threshold
    4. Trả về (response đã gắn [N], citation_source_lines, relevant_spans, used_chunk_indices)

    Fallback: nếu reranker không available, trả về response gốc không thay đổi.
    """
    try:
        reranker = get_reranker()
        if not reranker:
            return response, {}, [[] for _ in chunks], []
    except Exception:
        return response, {}, [[] for _ in chunks], []

    raw_lines = response.split('\n')
    units: list[tuple[int, str, str]] = []

    for idx, line in enumerate(raw_lines):
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r'^[-*•]\s+', stripped) or re.match(r'^\d+[\.\)]\s+', stripped):
            text = re.sub(r'^[-*•\d\.\)]+\s*', '', stripped)
            text = re.sub(r'\s*\[\d+\]\s*$', '', text).strip()
            if len(text) > 10:
                units.append((idx, line, text))
        else:
            sentences = re.split(r'(?<=[.!?])\s+', stripped)
            for sent in sentences:
                clean = re.sub(r'\s*\[\d+\]\s*', '', sent).strip()
                if len(clean) > 15:
                    units.append((idx, line, clean))

    if not units or not chunks:
        return response, {}, [[] for _ in chunks], []

    all_pairs = []
    for _, _, text in units:
        for chunk in chunks:
            all_pairs.append([text, chunk.content])

    try:
        all_scores = reranker.predict(all_pairs)
    except Exception as e:
        print(f"[PostHocCite ERROR] {e}")
        return response, {}, [[] for _ in chunks], []

    num_chunks = len(chunks)
    line_to_chunk: dict[int, int] = {}
    citation_source_lines: dict[int, list[str]] = {}

    for i, (line_idx, _, text) in enumerate(units):
        scores = all_scores[i * num_chunks: (i + 1) * num_chunks]
        scores_list = scores.tolist() if hasattr(scores, 'tolist') else list(scores)
        best_idx = int(max(range(num_chunks), key=lambda j: scores_list[j]))
        best_score = scores_list[best_idx]
        if best_score >= threshold:
            if line_idx not in line_to_chunk or scores_list[line_to_chunk[line_idx]] < best_score:
                line_to_chunk[line_idx] = best_idx
            citation_source_lines.setdefault(best_idx, []).append(text)

    used_chunk_indices = []
    for idx in sorted(line_to_chunk.keys()):
        c = line_to_chunk[idx]
        if c not in used_chunk_indices:
            used_chunk_indices.append(c)

    chunk_to_display: dict[int, int] = {c: n + 1 for n, c in enumerate(used_chunk_indices)}

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


def extract_relevant_spans_dynamic(chunk_queries: list[str], chunks: list) -> list[list[str]]:
    """Sử dụng câu văn LLM đã trích dẫn để tìm kiếm lại trong chunk gốc."""
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

    if not all_pairs:
        return [[] for _ in chunks]

    try:
        all_scores = reranker.predict(all_pairs)
    except Exception as e:
        print(f"[SubChunk ERROR] Batch predict thất bại: {e}")
        return [[] for _ in chunks]

    results: list[list[str]] = []
    for (start, end, sentences) in chunk_ranges:
        if not sentences:
            results.append([])
            continue
        chunk_scores = all_scores[start:end].tolist() if hasattr(all_scores, 'tolist') else list(all_scores[start:end])
        scored = sorted(zip(chunk_scores, sentences), key=lambda x: x[0], reverse=True)
        results.append([s for score, s in scored if score > -2.0][:3])

    return results
