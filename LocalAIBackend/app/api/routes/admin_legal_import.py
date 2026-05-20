"""
Admin – Legal Import Routes
============================
GET  /api/admin/legal-import/search?q=<keyword>&max=10
POST /api/admin/legal-import/download
     body: { item_ids: ["123","456",...], category_id: 1 }
"""

import os
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List

from app.api.dependencies import require_min_level
from app.db.session import SessionLocal
from app.models.user_model import User
from app.services.legal_importer import search_legal_docs, download_legal_doc
from app.services.ingestion_service import ingest_file

router = APIRouter()

_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "../../../../uploads/legal")


class DownloadRequest(BaseModel):
    item_ids: List[str]
    category_id: int = 1


def _do_import(item_ids: list[str], category_id: int, uploaded_by: int):
    """Background task: tải và ingest từng văn bản."""
    db = SessionLocal()
    try:
        for item_id in item_ids:
            try:
                file_path, title = download_legal_doc(item_id, _UPLOADS_DIR)
                ingest_file(
                    db=db,
                    file_path=file_path,
                    filename=os.path.basename(file_path),
                    file_type="txt",
                    category_id=category_id,
                    uploaded_by=uploaded_by,
                    scope="COMPANY",
                )
                print(f"[LegalImport] ✓ ItemID={item_id} — {title[:60]}")
            except Exception as e:
                print(f"[LegalImport] ✗ ItemID={item_id} — {e}")
    finally:
        db.close()


@router.get("/legal-import/search")
def search_docs(
    q: str = Query(..., min_length=2, description="Từ khóa tìm kiếm"),
    max: int = Query(10, ge=1, le=10),
    _: User = Depends(require_min_level(5)),
):
    """Tìm kiếm văn bản pháp luật trên vbpl.vn."""
    try:
        results = search_legal_docs(keyword=q, max_results=max)
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tìm kiếm: {e}")

    return {
        "keyword": q,
        "total": len(results),
        "results": [
            {
                "item_id": r.item_id,
                "title": r.title,
                "doc_type": r.doc_type,
                "issued_date": r.issued_date,
                "agency": r.agency,
                "url": r.url,
                "abstract": r.abstract,
            }
            for r in results
        ],
    }


@router.post("/legal-import/download")
def download_docs(
    body: DownloadRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_min_level(5)),
):
    """Tải và import văn bản đã chọn vào hệ thống (chạy nền)."""
    if not body.item_ids:
        raise HTTPException(status_code=400, detail="Chưa chọn văn bản nào")
    if len(body.item_ids) > 10:
        raise HTTPException(status_code=400, detail="Tối đa 10 văn bản mỗi lần")

    background_tasks.add_task(
        _do_import,
        item_ids=body.item_ids,
        category_id=body.category_id,
        uploaded_by=current_user.id,
    )

    return {
        "message": f"Đang import {len(body.item_ids)} văn bản ở nền. Kiểm tra trang Tài liệu sau vài phút.",
        "count": len(body.item_ids),
    }
