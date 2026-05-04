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

from sqlalchemy import text
from app.api.dependencies import get_db, get_current_user
from app.models.doc_model import Document, Category, CategoryPermission, UserDocPermission
from app.models.user_model import User
from app.services.ingestion_service import ingest_file
from app.services.vector_store import delete_documents_from_store
from app.api.routes.admin import write_audit_log

router = APIRouter()

# Thư mục lưu file upload (tương đối với nơi chạy server)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Định dạng file cho phép
ALLOWED_EXTENSIONS = {"pdf", "txt", "doc", "docx", "xls", "xlsx"}


def _get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _run_ingestion(file_path: str, filename: str, file_type: str,
                   category_id: int, uploaded_by: int, scope: str,
                   session_id: Optional[int] = None):
    """Chạy ingestion trong background thread (không block response)."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        ingest_file(
            db=db,
            file_path=file_path,
            filename=filename,
            file_type=file_type,
            category_id=category_id,
            uploaded_by=uploaded_by,
            scope=scope,
            session_id=session_id,
        )
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
    session_id: Optional[int] = Form(None),
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
        session_id=session_id if scope.upper() == "PERSONAL" else None,
    )

    write_audit_log(
        db, action="UPLOAD_DOC",
        username=current_user.username, user_id=current_user.id,
        entity_type="document", entity_id=safe_name,
        details={"filename": file.filename, "size": file.size},
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
    session_id: Optional[int] = Query(None, description="Filter personal docs by session"),
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

    # Tính quyền xem COMPANY docs cho non-admin
    if current_user.role.name != "admin":
        # 1. Doc-level permissions (user-specific)
        user_doc_ids = {
            p.document_id for p in db.query(UserDocPermission).filter(
                UserDocPermission.user_id == current_user.id
            ).all()
        }
        # 2. Department-level permissions
        from app.models.doc_model import DepartmentDocPermission
        dept_doc_ids = set()
        if current_user.department_id:
            dept_doc_ids = {
                p.document_id for p in db.query(DepartmentDocPermission).filter(
                    DepartmentDocPermission.department_id == current_user.department_id
                ).all()
            }
        # 3. Category-level permissions (role-based fallback — chỉ dùng khi không có dept perms)
        allowed_cat_ids = set()
        if not dept_doc_ids:
            allowed_cat_ids = {
                p.category_id for p in db.query(CategoryPermission).filter(
                    CategoryPermission.role_id == current_user.role_id,
                    CategoryPermission.can_view == True,
                ).all()
            }
    else:
        user_doc_ids = None
        dept_doc_ids = None
        allowed_cat_ids = None

    print(f"[DOC PERM] user={current_user.username} role={current_user.role.name} dept_id={current_user.department_id} | user_doc_ids={user_doc_ids} dept_doc_ids={dept_doc_ids} allowed_cat_ids={allowed_cat_ids}")

    result = []
    for d in docs:
        if d.document_scope == "PERSONAL":
            if d.uploaded_by != current_user.id:
                continue
            if session_id is not None and d.session_id != session_id:
                continue
        if d.document_scope == "COMPANY" and user_doc_ids is not None:
            if dept_doc_ids:
                # Dept perms là giới hạn tối đa — user_doc_ids không được vượt qua
                if d.id not in dept_doc_ids:
                    continue
            else:
                if d.id not in user_doc_ids and d.category_id not in allowed_cat_ids:
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

    # Thu thập vector_ids và page rowids TRƯỚC khi cascade xóa pages
    vector_ids = [p.vector_id for p in doc.pages if p.vector_id]
    page_ids   = [p.id        for p in doc.pages]

    # 1. Xóa vectors khỏi ChromaDB
    delete_documents_from_store(vector_ids)

    # 2. Xóa FTS index entries (content table sẽ bị xóa theo cascade, FTS phải xóa thủ công)
    if page_ids:
        placeholders = ",".join(str(i) for i in page_ids)
        try:
            db.execute(text(f"DELETE FROM document_pages_fts WHERE rowid IN ({placeholders})"))
        except Exception:
            pass  # FTS table có thể chưa tồn tại nếu chưa có search nào

    # 3. Xóa file trên disk
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    # 4. Xóa document (cascade → document_pages)
    doc_title = doc.title
    db.delete(doc)
    db.commit()

    write_audit_log(
        db, action="DELETE_DOC",
        username=current_user.username, user_id=current_user.id,
        entity_type="document", entity_id=str(doc_id),
        details={"title": doc_title},
    )

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
