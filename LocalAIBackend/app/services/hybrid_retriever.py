"""
Hybrid RAG Retriever
====================
Kết hợp 3 kỹ thuật nâng cao:
1. Semantic Search      – ChromaDB (Embedding similarity)
2. Keyword Search       – SQLite FTS5 (BM25 full-text matching)
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
    rrf_score: float
    source_type: str          # "semantic" | "keyword" | "hybrid"
    page_metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Hằng số cấu hình – có thể override từ settings sau
# ---------------------------------------------------------------------------

RRF_K = 60                  # Hằng số RRF để làm mượt điểm (paper gốc dùng 60)
MAX_NEIGHBOR_EXPAND = 1     # Lấy thêm N chunk trước/sau (Page Index Expansion)


# ---------------------------------------------------------------------------
# Bước 1 – Semantic Search qua ChromaDB
# ---------------------------------------------------------------------------

def _semantic_search(query: str, k: int, allowed_doc_ids: list[int] = None) -> list[tuple[str, float]]:
    """
    Trả về [(vector_id, relevance_score), ...] từ ChromaDB.
    Nếu metadata không có vector_id, fallback về page_content làm key tạm.
    """
    filter_dict = None
    if allowed_doc_ids is not None and len(allowed_doc_ids) > 0:
        filter_dict = {"document_id": {"$in": allowed_doc_ids}}

    results = search_documents(query, k=k, filter_dict=filter_dict)
    ranked: list[tuple[str, float]] = []
    for doc, score in results:
        vid = doc.metadata.get("vector_id") or doc.page_content[:40]
        ranked.append((vid, float(score)))
    return ranked


# ---------------------------------------------------------------------------
# Bước 2 – Keyword Search qua SQLite FTS5
# ---------------------------------------------------------------------------

def _keyword_search(db: Session, query: str, k: int, allowed_doc_ids: list[int] = None) -> list[tuple[str, float]]:
    """
    Tìm kiếm Full-Text trên bảng FTS ảo `document_pages_fts`.
    Trả về [(vector_id, bm25_score), ...].
    Nếu FTS chưa tồn tại, tự động tạo và đồng bộ dữ liệu.
    """
    _ensure_fts_table(db)

    doc_filter_sql = ""
    if allowed_doc_ids is not None and len(allowed_doc_ids) > 0:
        # SQLite doesn't directly support array bindings easily, format safely
        id_str = ",".join(str(int(did)) for did in allowed_doc_ids)
        doc_filter_sql = f"AND dp.document_id IN ({id_str})"

    sql = text(f"""
        SELECT dp.vector_id,
               bm25(document_pages_fts) AS score
        FROM document_pages_fts
        JOIN document_pages dp ON dp.rowid = document_pages_fts.rowid
        WHERE document_pages_fts MATCH :query
        {doc_filter_sql}
        ORDER BY score
        LIMIT :k
    """)
    try:
        rows = db.execute(sql, {"query": query, "k": k}).fetchall()
    except Exception:
        return []

    # bm25() trả về số âm – giá trị nhỏ hơn = tốt hơn → đổi thành dương
    max_score = max((abs(r.score) for r in rows), default=1.0) or 1.0
    return [(r.vector_id, abs(r.score) / max_score) for r in rows]


def _ensure_fts_table(db: Session) -> None:
    """Tạo bảng FTS5 ảo nếu chưa tồn tại và đồng bộ dữ liệu."""
    db.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS document_pages_fts
        USING fts5(raw_content, content='document_pages', content_rowid='id', tokenize='unicode61')
    """))
    # Đồng bộ bất kỳ dữ liệu mới (chèn sau khi bảng FTS đã tồn tại)
    db.execute(text("INSERT INTO document_pages_fts(document_pages_fts) VALUES('rebuild')"))
    db.commit()


# ---------------------------------------------------------------------------
# Bước 3 – Reciprocal Rank Fusion
# ---------------------------------------------------------------------------

def _reciprocal_rank_fusion(
    semantic_hits: list[tuple[str, float]],
    keyword_hits: list[tuple[str, float]],
    rrf_k: int = RRF_K,
) -> list[tuple[str, float]]:
    """
    Gộp 2 danh sách xếp hạng bằng RRF.
    Công thức: RRF(d) = Σ 1 / (k + rank(d))
    Trả về danh sách đã sắp xếp giảm dần theo điểm RRF.
    """
    scores: dict[str, float] = {}

    for rank, (vid, _) in enumerate(semantic_hits, start=1):
        scores[vid] = scores.get(vid, 0.0) + 1.0 / (rrf_k + rank)

    for rank, (vid, _) in enumerate(keyword_hits, start=1):
        scores[vid] = scores.get(vid, 0.0) + 1.0 / (rrf_k + rank)

    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


# ---------------------------------------------------------------------------
# Bước 4 – Page Index Expansion (lấy chunk liền kề)
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
    neighbor_window: int = MAX_NEIGHBOR_EXPAND,
    semantic_weight: float = 0.6,   # dự phòng; hiện tại RRF tự cân bằng
    allowed_doc_ids: list[int] = None
) -> list[RetrievedChunk]:
    """
    Hàm chính: Thực hiện Hybrid RAG Retrieval và trả về danh sách RetrievedChunk.

    Args:
        db:              SQLAlchemy session.
        query:           Câu hỏi của người dùng.
        top_k:           Số chunk hạt nhân cần lấy TRƯỚC khi mở rộng.
        neighbor_window: Số chunk liền kề mỗi bên để bổ sung ngữ cảnh.

    Returns:
        Danh sách RetrievedChunk sắp xếp theo document_id, chunk_index.
    """
    # 1. Semantic search
    semantic_hits = _semantic_search(query, k=top_k * 2, allowed_doc_ids=allowed_doc_ids)

    # 2. Keyword search (FTS5)
    keyword_hits = _keyword_search(db, query, k=top_k * 2, allowed_doc_ids=allowed_doc_ids)

    # 3. RRF fusion
    fused = _reciprocal_rank_fusion(semantic_hits, keyword_hits)[:top_k]

    if not fused:
        return []

    # 4. Lấy DocumentPage từ SQLite theo vector_id
    fused_ids = [vid for vid, _ in fused]
    rrf_score_map = {vid: score for vid, score in fused}

    core_pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.vector_id.in_(fused_ids))
        .all()
    )

    # 5. Page Index Expansion
    expanded_pages = _expand_with_neighbors(db, core_pages, window=neighbor_window)

    # 6. Build kết quả trả về
    result: list[RetrievedChunk] = []
    for page in expanded_pages:
        is_core = page.vector_id in rrf_score_map
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
            rrf_score=rrf_score_map.get(page.vector_id, 0.0),
            source_type="hybrid" if is_core else "neighbor_expand",
            page_metadata=meta,
        ))

    return result
