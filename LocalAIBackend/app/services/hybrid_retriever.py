"""
Hybrid RAG Retriever
====================
Kết hợp 3 kỹ thuật nâng cao:
1. Semantic Search      – ChromaDB (Embedding similarity)
2. Keyword Search       – MySQL FULLTEXT (Boolean mode matching)
3. Page Index Expansion – Lấy thêm chunk liền kề để bảo toàn ngữ cảnh

Kết quả của (1) và (2) được gộp bằng Reciprocal Rank Fusion (RRF)
trước khi thực hiện Page Expansion.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.doc_model import DocumentPage
from app.services.vector_store import search_documents
from app.core.config import settings

# Lazy loaded CrossEncoder
_reranker = None

# Flag tránh rebuild FTS index mỗi request — chỉ chạy 1 lần khi server start
_fts_initialized = False

def get_reranker():
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder
        import torch
        print(f"[RERANKER] Loading CrossEncoder model: {settings.RERANKER_MODEL_NAME}")
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        _reranker = CrossEncoder(settings.RERANKER_MODEL_NAME, max_length=512, device=device)
    return _reranker


def sync_page_to_fts(db: Session, page_id: int, raw_content: str) -> None:
    """MySQL FULLTEXT index tự động cập nhật khi insert vào document_pages — không cần sync thủ công."""
    pass


# ---------------------------------------------------------------------------
# Data class trả về từ retriever
# ---------------------------------------------------------------------------

@dataclass
class RetrievedChunk:
    """Một chunk đã được truy xuất, kèm điểm hợp nhất và metadata."""
    vector_id: str
    document_id: int
    chunk_index: int
    content: str
    token_count: int
    rerank_score: float
    source_type: str          # "semantic" | "keyword" | "hybrid"
    page_metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Hằng số cấu hình – có thể override từ settings sau
# ---------------------------------------------------------------------------

RRF_K = 60                  # Hằng số RRF để làm mượt điểm (paper gốc dùng 60)
MAX_NEIGHBOR_EXPAND = 0     # Parent-child chunking thay thế neighbor expand


# ---------------------------------------------------------------------------
# Bước 1 – Semantic Search qua ChromaDB
# ---------------------------------------------------------------------------

def _semantic_search(query: str, k: int, allowed_doc_ids: list[int] = None) -> list[tuple[str, float]]:
    """
    Trả về [(vector_id, relevance_score), ...] từ ChromaDB.
    Nếu metadata không có vector_id, fallback về page_content làm key tạm.
    """
    if allowed_doc_ids is not None and len(allowed_doc_ids) == 0:
        return []

    filter_dict = None
    if allowed_doc_ids is not None:
        filter_dict = {"document_id": {"$in": allowed_doc_ids}}

    results = search_documents(query, k=k, filter_dict=filter_dict)
    ranked: list[tuple[str, float]] = []
    for doc, score in results:
        vid = doc.metadata.get("vector_id") or doc.page_content[:40]
        ranked.append((vid, float(score)))
    return ranked


# ---------------------------------------------------------------------------
# Bước 2 – Keyword Search qua MySQL FULLTEXT
# ---------------------------------------------------------------------------

def _keyword_search(db: Session, query: str, k: int, allowed_doc_ids: list[int] = None) -> list[tuple[str, float]]:
    """
    Tìm kiếm Full-Text trên bảng document_pages bằng MySQL FULLTEXT BOOLEAN MODE.
    Trả về [(vector_id, relevance_score), ...].
    """
    if allowed_doc_ids is not None and len(allowed_doc_ids) == 0:
        return []

    _ensure_fts_index(db)

    doc_filter_sql = ""
    if allowed_doc_ids is not None:
        id_str = ",".join(str(int(did)) for did in allowed_doc_ids)
        doc_filter_sql = f"AND dp.document_id IN ({id_str})"

    sql = text(f"""
        SELECT dp.vector_id,
               MATCH(dp.raw_content) AGAINST (:query IN BOOLEAN MODE) AS score
        FROM document_pages dp
        WHERE MATCH(dp.raw_content) AGAINST (:query IN BOOLEAN MODE) > 0
        {doc_filter_sql}
        ORDER BY score DESC
        LIMIT :k
    """)

    # Tách token, bỏ token quá ngắn, dùng OR (+prefix optional) trong boolean mode
    tokens = [t.replace('"', '') for t in query.split() if len(t) > 2]
    fts_query = " ".join(tokens) if tokens else query
    try:
        rows = db.execute(sql, {"query": fts_query, "k": k}).fetchall()
    except Exception as e:
        print(f"[FTS WARNING] FTS query thất bại: {e}")
        return []

    max_score = max((r.score for r in rows), default=1.0) or 1.0
    return [(r.vector_id, float(r.score) / max_score) for r in rows]


def _ensure_fts_index(db: Session) -> None:
    """
    Tạo FULLTEXT INDEX trên document_pages.raw_content nếu chưa có.
    Chỉ chạy 1 lần khi server start.
    """
    global _fts_initialized
    if _fts_initialized:
        return
    try:
        result = db.execute(text("""
            SELECT COUNT(*) AS cnt
            FROM information_schema.STATISTICS
            WHERE table_schema = DATABASE()
              AND table_name = 'document_pages'
              AND index_name = 'idx_fulltext_raw_content'
        """)).fetchone()
        if result.cnt == 0:
            db.execute(text(
                "ALTER TABLE document_pages ADD FULLTEXT INDEX idx_fulltext_raw_content (raw_content)"
            ))
            db.commit()
            print("[FTS] FULLTEXT index created thành công.")
        else:
            print("[FTS] FULLTEXT index đã tồn tại, skip.")
        _fts_initialized = True
    except Exception as e:
        print(f"[FTS WARNING] Lỗi khởi tạo FULLTEXT index: {e}")
        try:
            db.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Bước 3 – Reciprocal Rank Fusion
# ---------------------------------------------------------------------------

def _reciprocal_rank_fusion(
    semantic_hits: list[tuple[str, float]],
    keyword_hits: list[tuple[str, float]],
    rrf_k: int = RRF_K,
) -> list[tuple[str, float]]:
    """
    Gộp 2 danh sách xếp hạng bằng RRF với boost cho FTS exact match.
    Khi FTS score >= 0.8 (exact keyword match), nhân trọng số x3 để
    tránh bị semantic search lấn át (VD: "ảnh" bị nhầm sang "image").
    """
    scores: dict[str, float] = {}

    for rank, (vid, _) in enumerate(semantic_hits, start=1):
        scores[vid] = scores.get(vid, 0.0) + 1.0 / (rrf_k + rank)

    for rank, (vid, raw_score) in enumerate(keyword_hits, start=1):
        # Boost FTS khi exact match (score cao) để không bị semantic lấn át
        weight = 3.0 if raw_score >= 0.8 else 1.0
        scores[vid] = scores.get(vid, 0.0) + weight / (rrf_k + rank)

    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


# ---------------------------------------------------------------------------
# Bước 4 – Parent Swap (child → parent để LLM có ngữ cảnh đầy đủ)
# ---------------------------------------------------------------------------

def _swap_children_for_parents(
    db: Session,
    pages: list[DocumentPage],
) -> list[DocumentPage]:
    """
    Với mỗi child chunk đã tìm được, lấy parent từ MySQL và thay thế.
    Flat/parent chunks giữ nguyên.
    Dedup: nhiều children cùng parent → chỉ trả 1 parent row.
    Rerank score của parent = score tốt nhất trong các children của nó.
    """
    result_map: dict[int, DocumentPage] = {}
    best_score: dict[int, float] = {}

    parent_ids: list[int] = []
    direct: list[DocumentPage] = []

    for page in pages:
        if getattr(page, "chunk_type", "flat") == "child" and page.parent_chunk_id is not None:
            parent_ids.append(page.parent_chunk_id)
            score = getattr(page, "_temp_rerank_score", 0.0)
            best_score[page.parent_chunk_id] = max(best_score.get(page.parent_chunk_id, float("-inf")), score)
        else:
            direct.append(page)

    if parent_ids:
        parent_pages = (
            db.query(DocumentPage)
            .filter(DocumentPage.id.in_(parent_ids))
            .all()
        )
        for p in parent_pages:
            if p.id not in result_map:
                p._temp_rerank_score = best_score.get(p.id, 0.0)
                result_map[p.id] = p

    for page in direct:
        if page.id not in result_map:
            result_map[page.id] = page

    return list(result_map.values())


# ---------------------------------------------------------------------------
# Bước 4b – Page Index Expansion (giữ lại cho hybrid_retrieve_multi)
# ---------------------------------------------------------------------------

def _expand_with_neighbors(
    db: Session,
    core_pages: list[DocumentPage],
    window: int = MAX_NEIGHBOR_EXPAND,
) -> list[DocumentPage]:
    """
    Với mỗi chunk đã tìm được, lấy thêm N chunk trước và sau cùng document.
    Dedup theo id, giữ thứ tự chunk_index tăng dần.
    """
    seen_ids: set[int] = set()
    expanded: list[DocumentPage] = []

    for page in core_pages:
        doc_id = page.document_id
        lo = max(0, page.chunk_index - window)
        hi = page.chunk_index + window

        neighbors = (
            db.query(DocumentPage)
            .filter(
                DocumentPage.document_id == doc_id,
                DocumentPage.chunk_index >= lo,
                DocumentPage.chunk_index <= hi,
            )
            .order_by(DocumentPage.chunk_index)
            .all()
        )
        for n in neighbors:
            if n.id not in seen_ids:
                seen_ids.add(n.id)
                expanded.append(n)

    expanded.sort(key=lambda p: (p.document_id, p.chunk_index))
    return expanded


# ---------------------------------------------------------------------------
# Entry-point chính
# ---------------------------------------------------------------------------

def hybrid_retrieve(
    db: Session,
    query: str,
    top_k: int = 5,
    allowed_doc_ids: list[int] = None,
    **_kwargs,  # bỏ qua neighbor_window/semantic_weight nếu caller cũ vẫn truyền vào
) -> list[RetrievedChunk]:
    """
    Hàm chính: Thực hiện Hybrid RAG Retrieval và trả về danh sách RetrievedChunk.

    Args:
        db:              MYSQL.
        query:           Câu hỏi của người dùng.
        top_k:           Số chunk hạt nhân cần lấy TRƯỚC khi mở rộng.
        neighbor_window: Số chunk liền kề mỗi bên để bổ sung ngữ cảnh.

    Returns:
        Danh sách RetrievedChunk sắp xếp theo document_id, chunk_index.
    """
    # 1. Candidate Retrieval (Lấy số lượng lớn)
    fetch_k = top_k * 3
    semantic_hits = _semantic_search(query, k=fetch_k, allowed_doc_ids=allowed_doc_ids)
    keyword_hits = _keyword_search(db, query, k=fetch_k, allowed_doc_ids=allowed_doc_ids)

    # 2. Bỏ trùng lặp
    candidate_ids = set([vid for vid, _ in semantic_hits])
    candidate_ids.update([vid for vid, _ in keyword_hits])

    if not candidate_ids:
        return []

    # 3. Lấy nội dung từ MySQL để chuẩn bị chấm điểm
    core_pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.vector_id.in_(list(candidate_ids)))
        .all()
    )

    if not core_pages:
        return []

    # 4. Re-ranking bằng Cross-Encoder + RRF tiebreaker
    fused = _reciprocal_rank_fusion(semantic_hits, keyword_hits)
    rrf_rank_map = {vid: rank for rank, (vid, _) in enumerate(fused)}  # rank 0 = best

    # Map raw FTS score để boost chunk có exact keyword match (tránh reranker ưu tiên tiếng Anh)
    fts_score_map = {vid: score for vid, score in keyword_hits}

    pairs = [(query, page.raw_content) for page in core_pages]
    reranker = get_reranker()
    scores = reranker.predict(pairs)

    n = len(fused) or 1
    for idx, page in enumerate(core_pages):
        ce_score = float(scores[idx])
        rrf_rank = rrf_rank_map.get(page.vector_id, n)
        rrf_bonus = (n - rrf_rank) / n * 0.5
        # Boost mạnh khi FTS exact match (score >= 0.8) để không bị CE tiếng Anh lấn át
        raw_fts = fts_score_map.get(page.vector_id, 0.0)
        fts_boost = raw_fts * 5.0 if raw_fts >= 0.8 else 0.0
        page._temp_rerank_score = ce_score + rrf_bonus + fts_boost

    # Sắp xếp giảm dần theo điểm và lấy Top K
    core_pages.sort(key=lambda p: p._temp_rerank_score, reverse=True)
    top_core_pages = core_pages[:top_k]
    
    # Lưu điểm lại cho output
    score_map = {p.vector_id: p._temp_rerank_score for p in top_core_pages}

    # 5. Swap children → parents để LLM có ngữ cảnh đầy đủ
    context_pages = _swap_children_for_parents(db, top_core_pages)
    # Re-sort sau parent swap vì _swap_children_for_parents không bảo toàn thứ tự điểm
    context_pages.sort(key=lambda p: score_map.get(p.vector_id, getattr(p, "_temp_rerank_score", 0.0)), reverse=True)

    # 5b. Forward-expand: thêm chunk liền sau mỗi parent để tránh nội dung bị cắt giữa chừng
    existing_ids = {p.id for p in context_pages}
    forward_pages: list[DocumentPage] = []
    for page in context_pages:
        if getattr(page, "chunk_type", "flat") in ("parent", "flat"):
            nxt = (
                db.query(DocumentPage)
                .filter(
                    DocumentPage.document_id == page.document_id,
                    DocumentPage.chunk_index == page.chunk_index + 1,
                    DocumentPage.chunk_type.in_(["parent", "flat"]),
                )
                .first()
            )
            if nxt and nxt.id not in existing_ids:
                nxt._temp_rerank_score = score_map.get(page.vector_id, 0.0) - 0.1
                forward_pages.append(nxt)
                existing_ids.add(nxt.id)
    context_pages.extend(forward_pages)

    # 6. Build kết quả trả về
    result: list[RetrievedChunk] = []
    for page in context_pages:
        is_core = page.vector_id in score_map
        meta = {}
        try:
            meta = json.loads(page.page_metadata or "{}")
        except (ValueError, TypeError):
            pass

        result.append(RetrievedChunk(
            vector_id=page.vector_id,
            document_id=page.document_id,
            chunk_index=page.chunk_index,
            content=page.raw_content,
            token_count=page.token_count,
            rerank_score=score_map.get(page.vector_id, getattr(page, "_temp_rerank_score", 0.0)),
            source_type="hybrid" if is_core else "parent_swap",
            page_metadata=meta,
        ))

    return result


# ---------------------------------------------------------------------------
# Adaptive Retrieval — multi-query expansion + confidence check
# ---------------------------------------------------------------------------

def _retrieval_is_confident(chunks: list) -> bool:
    """
    mmarco-mMiniLMv2 scores Vietnamese text typically in [-7, -2] range.
    Relevant chunks score around -2 to -4; irrelevant around -4 to -7.
    Threshold -4.0: trigger adaptive khi top chunk kém hoặc câu hỏi yes/no cần suy luận.
    """
    if not chunks:
        return False
    top_score = max(c.rerank_score for c in chunks if c.source_type != "neighbor_expand")
    return top_score > -4.0


def retrieve_for_summary(
    db: Session,
    allowed_doc_ids: list[int] = None,
    max_chunks: int = 10,
) -> list[RetrievedChunk]:
    """
    Lấy chunks phân bổ đều từ đầu/giữa/cuối tài liệu thay vì dùng similarity.
    Dùng khi user yêu cầu tóm tắt toàn bộ tài liệu — query vague như "tóm tắt file này"
    không khớp ngữ nghĩa tốt với content, nên cần scan trực tiếp qua MySQL.
    """
    if allowed_doc_ids is not None and len(allowed_doc_ids) == 0:
        return []

    query = db.query(DocumentPage).filter(
        DocumentPage.chunk_type.in_(["parent", "flat"])
    )
    if allowed_doc_ids is not None:
        query = query.filter(DocumentPage.document_id.in_(allowed_doc_ids))

    all_pages: list[DocumentPage] = (
        query.order_by(DocumentPage.document_id, DocumentPage.chunk_index).all()
    )
    if not all_pages:
        return []

    if len(all_pages) <= max_chunks:
        selected = all_pages
    else:
        step = len(all_pages) / max_chunks
        selected = [all_pages[int(i * step)] for i in range(max_chunks)]

    result: list[RetrievedChunk] = []
    for page in selected:
        meta = {}
        try:
            meta = json.loads(page.page_metadata or "{}")
        except (ValueError, TypeError):
            pass
        result.append(RetrievedChunk(
            vector_id=page.vector_id,
            document_id=page.document_id,
            chunk_index=page.chunk_index,
            content=page.raw_content,
            token_count=page.token_count,
            rerank_score=1.0,
            source_type="summary_scan",
            page_metadata=meta,
        ))
    return result


def hybrid_retrieve_multi(
    db: Session,
    queries: list[str],
    top_k: int = 7,
    allowed_doc_ids: list[int] = None,
    **_kwargs,
) -> list[RetrievedChunk]:
    """
    Chạy hybrid_retrieve cho nhiều query variants, dedup, re-rank với original query.
    Dùng khi query expansion được kích hoạt (confidence thấp).

    Args:
        queries: [original_query, variant_1, variant_2, ...]
                 queries[0] luôn là câu hỏi gốc (dùng để re-rank cuối)
        top_k:   Số chunks trả về sau khi merge & re-rank
    """
    if not queries:
        return []

    original_query = queries[0]
    seen_vector_ids: set[str] = set()
    merged_pages: list = []  # (DocumentPage, highest_rerank_score)

    # Chạy retrieval cho từng query variant, collect unique pages
    for q in queries:
        chunks = hybrid_retrieve(db=db, query=q, top_k=top_k,
                                  neighbor_window=0,  # Không expand ở đây; expand sau
                                  allowed_doc_ids=allowed_doc_ids)
        for chunk in chunks:
            if chunk.vector_id not in seen_vector_ids:
                seen_vector_ids.add(chunk.vector_id)
                # Tìm lại DocumentPage để re-rank
                page = (
                    db.query(DocumentPage)
                    .filter(DocumentPage.vector_id == chunk.vector_id)
                    .first()
                )
                if page:
                    merged_pages.append(page)

    if not merged_pages:
        return []

    # Re-rank merged pool với original query
    reranker = get_reranker()
    pairs = [(original_query, page.raw_content) for page in merged_pages]
    scores = reranker.predict(pairs)

    for idx, page in enumerate(merged_pages):
        page._temp_rerank_score = float(scores[idx])

    merged_pages.sort(key=lambda p: p._temp_rerank_score, reverse=True)
    top_pages = merged_pages[:top_k]
    score_map = {p.vector_id: p._temp_rerank_score for p in top_pages}

    context_pages = _swap_children_for_parents(db, top_pages)

    result: list[RetrievedChunk] = []
    for page in context_pages:
        is_core = page.vector_id in score_map
        meta = {}
        try:
            meta = json.loads(page.page_metadata or "{}")
        except (ValueError, TypeError):
            pass
        result.append(RetrievedChunk(
            vector_id=page.vector_id,
            document_id=page.document_id,
            chunk_index=page.chunk_index,
            content=page.raw_content,
            token_count=page.token_count,
            rerank_score=score_map.get(page.vector_id, 0.0),
            source_type="hybrid_multi" if is_core else "neighbor_expand",
            page_metadata=meta,
        ))

    return result
