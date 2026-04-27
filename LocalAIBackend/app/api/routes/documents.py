"""
Documents API
=============
- POST /upload     : Nhận file, lưu disk, chạy ingestion trong background
- GET  /list       : Danh sách tài liệu thật từ SQLite (có filter scope/category)
- GET  /categories : Danh sách category
- DELETE /{doc_id} : Xoá tài liệu
"""

import os
import shutil
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_db, get_current_user
from app.models.doc_model import Document, Category, CategoryPermission
from app.models.user_model import User
from app.services.ingestion_service import ingest_file

router = APIRouter()

# Thư mục lưu file upload (tương đối với nơi chạy server)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Định dạng file cho phép
ALLOWED_EXTENSIONS = {"pdf", "txt", "doc", "docx", "xls", "xlsx"}


def _get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _run_ingestion(file_path: str, filename: str, file_type: str,
                   category_id: int, uploaded_by: int, scope: str):
    """Chạy ingestion trong background thread (không block response)."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        doc = ingest_file(
            db=db,
            file_path=file_path,
            filename=filename,
            file_type=file_type,
            category_id=category_id,
            uploaded_by=uploaded_by,
        )
        # Cập nhật scope sau khi tạo
        doc.document_scope = scope.upper()
        db.commit()
    except Exception as e:
        print(f"[Ingestion ERROR] {filename}: {e}")
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────────────
# POST /upload
# ────────────────────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category_id: int = Form(1),
    scope: str = Form("COMPANY"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Nhận file từ frontend, lưu vào disk, và chạy ingestion trong background.
    Trả về ngay lập tức với status PROCESSING để UI cập nhật.
    """
    # Kiểm tra quyền upload vào kho chung
    if scope.upper() == "COMPANY" and current_user.role.name != "admin":
        perm = db.query(CategoryPermission).filter(
            CategoryPermission.role_id == current_user.role_id,
            CategoryPermission.category_id == category_id,
            CategoryPermission.can_upload == True,
        ).first()
        if not perm:
            raise HTTPException(status_code=403, detail="Không có quyền upload vào danh mục này")

    ext = _get_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng '{ext}' chưa được hỗ trợ. Chấp nhận: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Đảm bảo category tồn tại; nếu không → dùng category đầu tiên hoặc tạo mới
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        # Tạo category mặc định nếu chưa có
        category = Category(name="Chung", description="Category mặc định")
        db.add(category)
        db.commit()
        db.refresh(category)
        category_id = category.id

    # Lưu file vào disk
    safe_name = file.filename.replace(" ", "_")
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    # Tránh ghi đè — thêm timestamp nếu trùng tên
    if os.path.exists(file_path):
        import time
        name, dot_ext = os.path.splitext(safe_name)
        safe_name = f"{name}_{int(time.time())}{dot_ext}"
        file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Chạy ingestion trong background (không block response)
    background_tasks.add_task(
        _run_ingestion,
        file_path=file_path,
        filename=safe_name,
        file_type=ext,
        category_id=category_id,
        uploaded_by=current_user.id,
        scope=scope,
    )

    return {
        "success": True,
        "filename": safe_name,
        "file_path": file_path,
        "status": "PROCESSING",
        "message": f"File '{file.filename}' đã được nhận và đang xử lý ingestion..."
    }


# ────────────────────────────────────────────────────────────────────────────
# GET /list
# ────────────────────────────────────────────────────────────────────────────
@router.get("/list")
async def list_documents(
    scope: Optional[str] = Query(None, description="'PERSONAL' | 'COMPANY' | None = all"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trả về danh sách tài liệu thực từ SQLite, nhóm theo scope và category.
    Frontend dùng document.id (integer) làm key cho checkbox selection.
    """
    query = db.query(Document).options(joinedload(Document.category))

    if scope:
        query = query.filter(Document.document_scope == scope.upper())
    if category_id is not None:
        query = query.filter(Document.category_id == category_id)

    docs = query.order_by(Document.created_at.desc()).all()

    # Lấy danh sách category_id user được xem trong kho chung (admin thấy tất cả)
    if current_user.role.name != "admin":
        allowed_cat_ids = {
            p.category_id for p in db.query(CategoryPermission).filter(
                CategoryPermission.role_id == current_user.role_id,
                CategoryPermission.can_view == True,
            ).all()
        }
    else:
        allowed_cat_ids = None  # None = không giới hạn

    result = []
    for d in docs:
        # Kho cá nhân → chỉ hiện với đúng user upload
        if d.document_scope == "PERSONAL" and d.uploaded_by != current_user.id:
            continue
        # Kho chung → chỉ hiện category được phân quyền can_view
        if d.document_scope == "COMPANY" and allowed_cat_ids is not None:
            if d.category_id not in allowed_cat_ids:
                continue
        result.append({
            "id": d.id,
            "title": d.title,
            "file_type": d.file_type,
            "scope": d.document_scope,
            "category_id": d.category_id,
            "category_name": d.category.name if d.category else None,
            "ingestion_status": d.ingestion_status,
            "total_tokens": d.total_tokens,
            "uploaded_by": d.uploaded_by,
        })

    return {"documents": result, "total": len(result)}


# ────────────────────────────────────────────────────────────────────────────
# GET /categories
# ────────────────────────────────────────────────────────────────────────────
@router.get("/categories")
async def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    return {"categories": [
        {"id": c.id, "name": c.name, "description": c.description}
        for c in cats
    ]}


# ────────────────────────────────────────────────────────────────────────────
# DELETE /{doc_id}
# ────────────────────────────────────────────────────────────────────────────
@router.delete("/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    if doc.uploaded_by != current_user.id and current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Không có quyền xóa tài liệu này")

    # Xoá file trên disk nếu còn
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    db.delete(doc)
    db.commit()
    return {"success": True, "message": f"Đã xoá tài liệu id={doc_id}"}


# ────────────────────────────────────────────────────────────────────────────
# GET /content
# ────────────────────────────────────────────────────────────────────────────
@router.get("/content")
async def get_document_content(
    filename: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Trả về tất cả các page (chunk) của tài liệu dựa theo tên file (title).
    Dành cho chức năng DocumentViewer ở frontend.
    """
    if not filename:
        return {"filename": "", "pages": [], "ingestion_status": None}

    from app.models.doc_model import DocumentPage
    import json as _json

    # 1. Tìm exact match trước
    doc = db.query(Document).filter(Document.title == filename).order_by(Document.created_at.desc()).first()

    # 2. Fallback: case-insensitive (SQLite ilike via lower())
    if not doc:
        from sqlalchemy import func
        doc = (
            db.query(Document)
            .filter(func.lower(Document.title) == filename.lower())
            .order_by(Document.created_at.desc())
            .first()
        )

    if not doc:
        raise HTTPException(status_code=404, detail=f"Tài liệu '{filename}' không tồn tại trong hệ thống.")

    # Nếu đang xử lý hoặc lỗi — trả status để frontend hiển thị thông báo phù hợp
    if doc.ingestion_status in ("PROCESSING", "PENDING"):
        return {
            "filename": doc.title,
            "pages": [],
            "ingestion_status": doc.ingestion_status,
        }

    if doc.ingestion_status == "FAILED":
        raise HTTPException(
            status_code=422,
            detail=f"Tài liệu '{filename}' gặp lỗi khi xử lý: {doc.error_message or 'Không rõ lý do'}"
        )

    pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.document_id == doc.id)
        .order_by(DocumentPage.chunk_index.asc())
        .all()
    )

    result = []
    for p in pages:
        # Parse page_metadata (nếu có) để lấy thêm thông tin
        meta = {}
        if p.page_metadata:
            try:
                meta = _json.loads(p.page_metadata)
            except Exception:
                pass

        result.append({
            "page": p.chunk_index + 1,
            "lines": [line for line in p.raw_content.split('\n')],
            "title": meta.get("heading"),       # None nếu không có heading
            "chunk_index": p.chunk_index,
            "token_count": p.token_count,
        })

    return {
        "filename": doc.title,
        "pages": result,
        "ingestion_status": doc.ingestion_status,
        "total_tokens": doc.total_tokens,
        "total_chunks": len(result),
    }
