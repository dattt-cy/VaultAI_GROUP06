"""
Admin Router – /api/admin/*
Cung cấp giao diện JSON để quản lý và giám sát hệ thống.
Không yêu cầu xác thực (chỉ dùng nội bộ / dev).
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import os, uuid, shutil
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import psutil
import requests as http_requests

from app.db.session import get_db
from app.api.dependencies import require_min_level
from app.models.doc_model import Document, DocumentPage, Category, CategoryPermission, UserDocPermission, DepartmentDocPermission
from app.models.user_model import User, Role, Department
from app.models.chat_model import ChatSession, Message, Feedback
from app.models.sys_model import LlmConfig, SystemPrompt, AuditLog
from app.services.vector_store import get_vector_store
from app.core.config import settings

router = APIRouter()


# ─────────────────────────────────────────────
# Helper: ghi audit log
# ─────────────────────────────────────────────
import json as _json

def write_audit_log(
    db: Session,
    action: str,
    username: str | None = None,
    user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
):
    log = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        details_json=_json.dumps(details, ensure_ascii=False) if details else None,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()


# ─────────────────────────────────────────────
# 1. Tổng quan toàn bộ hệ thống
# ─────────────────────────────────────────────
@router.get("/overview", summary="Tổng quan hệ thống")
def overview(db: Session = Depends(get_db)):
    """Dashboard stats: user/doc/chat counts, ingestion breakdown, ChromaDB status."""
    total_users = db.query(User).count()
    total_documents = db.query(Document).count()
    total_sessions = db.query(ChatSession).count()
    total_messages = db.query(Message).count()

    ingestion_stats = {
        "COMPLETED": db.query(Document).filter(Document.ingestion_status == "COMPLETED").count(),
        "PROCESSING": db.query(Document).filter(Document.ingestion_status == "PROCESSING").count(),
        "PENDING": db.query(Document).filter(Document.ingestion_status == "PENDING").count(),
        "FAILED": db.query(Document).filter(Document.ingestion_status == "FAILED").count(),
    }

    try:
        vs = get_vector_store()
        chroma_count = vs._collection.count()
        chroma_status = "connected"
    except Exception as e:
        chroma_count = -1
        chroma_status = f"error: {e}"

    return {
        "total_users": total_users,
        "total_documents": total_documents,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "ingestion_stats": ingestion_stats,
        "chroma_status": chroma_status,
        "chroma_vectors": chroma_count,
    }


# ─────────────────────────────────────────────
# 2. Danh sách Documents + số chunks
# ─────────────────────────────────────────────
@router.get("/documents", summary="Danh sách tài liệu")
def list_documents(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    docs = db.query(Document).offset(skip).limit(limit).all()
    result = []
    for d in docs:
        chunk_count = db.query(DocumentPage).filter_by(document_id=d.id).count()
        result.append({
            "id": d.id,
            "title": d.title,
            "file_type": d.file_type,
            "file_size_bytes": d.file_size_bytes,
            "total_tokens": d.total_tokens,
            "ingestion_status": d.ingestion_status,
            "scope": d.document_scope,
            "document_scope": d.document_scope,
            "category_id": d.category_id,
            "category_name": d.category.name if d.category else None,
            "chunk_count": chunk_count,
            "created_at": str(d.created_at),
            "error_message": d.error_message,
        })
    return {"total": len(result), "items": result}


# ─────────────────────────────────────────────
# 3. Chi tiết Chunks của một Document
# ─────────────────────────────────────────────
@router.get("/documents/{document_id}/chunks", summary="Chunks của tài liệu")
def list_chunks(document_id: int, db: Session = Depends(get_db)):
    pages = (
        db.query(DocumentPage)
        .filter_by(document_id=document_id)
        .order_by(DocumentPage.chunk_index)
        .all()
    )
    return {
        "document_id": document_id,
        "total_chunks": len(pages),
        "chunks": [
            {
                "id": p.id,
                "chunk_index": p.chunk_index,
                "token_count": p.token_count,
                "vector_id": p.vector_id,
                "content_preview": p.raw_content[:200],
            }
            for p in pages
        ],
    }


# ─────────────────────────────────────────────
# 4. ChromaDB – xem trực tiếp vectors đã lưu
# ─────────────────────────────────────────────
@router.get("/chroma/vectors", summary="Xem các Vector đã lưu trong ChromaDB")
def chroma_vectors(limit: int = 20):
    try:
        vs = get_vector_store()
        collection = vs._collection
        data = collection.get(limit=limit, include=["documents", "metadatas"])
        items = []
        for i, vid in enumerate(data["ids"]):
            items.append({
                "vector_id": vid,
                "metadata": data["metadatas"][i] if data["metadatas"] else {},
                "content_preview": (data["documents"][i][:200] if data["documents"] else ""),
            })
        return {"total_in_collection": collection.count(), "items": items}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# 5. Users – list (read-only)
# ─────────────────────────────────────────────
@router.get("/users", summary="Danh sách người dùng")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "department_id": u.department_id,
            "department": u.department.name if u.department else None,
            "role_id": u.role_id,
            "is_active": u.is_active,
            "last_login": str(u.last_login) if u.last_login else None,
            "created_at": str(u.created_at) if u.created_at else None,
            "avatar_url": u.avatar_url,
        }
        for u in users
    ]


# ─────────────────────────────────────────────
# 6. System Metrics (CPU / RAM / VRAM + Ollama)
# ─────────────────────────────────────────────
@router.get("/system/metrics", summary="Tài nguyên hệ thống")
def system_metrics():
    """Trả về CPU%, RAM, VRAM (qua nvidia-smi nếu có) và trạng thái Ollama."""
    cpu_percent = psutil.cpu_percent(interval=0.2)
    vm = psutil.virtual_memory()
    ram_used_mb = vm.used // (1024 * 1024)
    ram_total_mb = vm.total // (1024 * 1024)

    # VRAM qua nvidia-smi
    vram_used_mb = 0
    vram_total_mb = 0
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            used_str, total_str = result.stdout.strip().split(",")
            vram_used_mb = int(used_str.strip())
            vram_total_mb = int(total_str.strip())
    except Exception:
        pass

    # Ollama status
    ollama_online = False
    try:
        resp = http_requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2)
        ollama_online = resp.status_code == 200
    except Exception:
        pass

    return {
        "cpu_percent": cpu_percent,
        "ram_used_mb": ram_used_mb,
        "ram_total_mb": ram_total_mb,
        "vram_used_mb": vram_used_mb,
        "vram_total_mb": vram_total_mb,
        "ollama": {
            "url": settings.OLLAMA_BASE_URL,
            "model": settings.LLM_MODEL_NAME,
            "online": ollama_online,
        },
    }


# ─────────────────────────────────────────────
# 7. Users – CRUD
# ─────────────────────────────────────────────
from pydantic import BaseModel
from typing import Optional

from app.core.security import get_password_hash


class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    department_id: Optional[int] = None
    role_id: int = 2  # default: user role


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    role_id: Optional[int] = None
    password: Optional[str] = None


@router.post("/users", summary="Tạo người dùng mới", status_code=201, dependencies=[Depends(require_min_level(9))])
def create_user(body: UserCreateRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username đã tồn tại")
    user = User(
        username=body.username,
        password_hash=get_password_hash(body.password),
        full_name=body.full_name,
        email=body.email,
        department_id=body.department_id,
        role_id=body.role_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "full_name": user.full_name}


@router.patch("/users/{user_id}", summary="Cập nhật thông tin người dùng", dependencies=[Depends(require_min_level(9))])
def update_user(user_id: int, body: UserUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    if body.department_id is not None:
        user.department_id = body.department_id
    if body.role_id is not None:
        user.role_id = body.role_id
    if body.password is not None:
        user.password_hash = get_password_hash(body.password)
    db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/toggle-active", summary="Bật/tắt trạng thái người dùng", dependencies=[Depends(require_min_level(9))])
def toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.delete("/users/{user_id}", summary="Xóa người dùng", status_code=204, dependencies=[Depends(require_min_level(9))])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    db.delete(user)
    db.commit()


AVATAR_DIR = os.path.join(os.path.dirname(__file__), "../../../../uploads/avatars")

@router.post("/users/{user_id}/avatar", summary="Upload avatar người dùng")
async def upload_avatar(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file ảnh (jpg, png, webp, gif)")
    os.makedirs(AVATAR_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"user_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = os.path.join(AVATAR_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    return {"avatar_url": user.avatar_url}


# ─────────────────────────────────────────────
# 8. Categories – CRUD
# ─────────────────────────────────────────────
class CategoryCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/categories", summary="Danh sách danh mục")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "document_count": db.query(Document).filter(Document.category_id == c.id).count(),
            "created_at": str(c.created_at),
        }
        for c in cats
    ]


@router.post("/categories", summary="Tạo danh mục mới", status_code=201)
def create_category(body: CategoryCreateRequest, db: Session = Depends(get_db)):
    cat = Category(name=body.name, description=body.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name}


@router.patch("/categories/{cat_id}", summary="Cập nhật danh mục")
def update_category(cat_id: int, body: CategoryUpdateRequest, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Danh mục không tồn tại")
    if body.name is not None:
        cat.name = body.name
    if body.description is not None:
        cat.description = body.description
    db.commit()
    return {"ok": True}


@router.delete("/categories/{cat_id}", summary="Xóa danh mục", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Danh mục không tồn tại")
    doc_count = db.query(Document).filter(Document.category_id == cat_id).count()
    if doc_count > 0:
        raise HTTPException(status_code=400, detail=f"Không thể xóa: danh mục còn {doc_count} tài liệu")
    db.delete(cat)
    db.commit()


# ─────────────────────────────────────────────
# 9. Roles – CRUD
# ─────────────────────────────────────────────
class RoleCreateRequest(BaseModel):
    name: str
    access_level: int
    description: Optional[str] = None


@router.get("/roles", summary="Danh sách vai trò", dependencies=[Depends(require_min_level(9))])
def list_roles(db: Session = Depends(get_db)):
    roles = db.query(Role).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "access_level": r.access_level,
            "description": r.description,
            "user_count": db.query(User).filter(User.role_id == r.id).count(),
        }
        for r in roles
    ]


@router.post("/roles", summary="Tạo vai trò mới", status_code=201, dependencies=[Depends(require_min_level(10))])
def create_role(body: RoleCreateRequest, db: Session = Depends(get_db)):
    role = Role(name=body.name, access_level=body.access_level, description=body.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"id": role.id, "name": role.name}


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    access_level: Optional[int] = None
    description: Optional[str] = None


@router.patch("/roles/{role_id}", summary="Cập nhật vai trò", dependencies=[Depends(require_min_level(10))])
def update_role(role_id: int, body: RoleUpdateRequest, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Vai trò không tồn tại")
    if role.name == "admin" and body.name and body.name != "admin":
        raise HTTPException(status_code=400, detail="Không thể đổi tên vai trò admin")
    
    if body.name is not None:
        role.name = body.name
    if body.access_level is not None:
        role.access_level = body.access_level
    if body.description is not None:
        role.description = body.description
    
    db.commit()
    return {"ok": True}


@router.delete("/roles/{role_id}", summary="Xóa vai trò", status_code=204, dependencies=[Depends(require_min_level(10))])
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Vai trò không tồn tại")
    if role.name == "admin":
        raise HTTPException(status_code=400, detail="Không thể xóa vai trò admin")
    user_count = db.query(User).filter(User.role_id == role_id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Không thể xóa: còn {user_count} người dùng dùng vai trò này")
    db.delete(role)
    db.commit()


# ─────────────────────────────────────────────
# 10b. Departments – CRUD
# ─────────────────────────────────────────────
class DepartmentCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/departments", summary="Danh sách phòng ban")
def list_departments(db: Session = Depends(get_db)):
    depts = db.query(Department).order_by(Department.name).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "user_count": db.query(User).filter(User.department_id == d.id).count(),
            "created_at": str(d.created_at),
        }
        for d in depts
    ]


@router.get("/departments/{dept_id}", summary="Chi tiết phòng ban")
def get_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Phòng ban không tồn tại")
    return {
        "id": dept.id,
        "name": dept.name,
        "description": dept.description,
        "user_count": db.query(User).filter(User.department_id == dept.id).count(),
        "created_at": str(dept.created_at),
    }


@router.post("/departments", summary="Tạo phòng ban mới", status_code=201, dependencies=[Depends(require_min_level(9))])
def create_department(body: DepartmentCreateRequest, db: Session = Depends(get_db)):
    if db.query(Department).filter(Department.name == body.name).first():
        raise HTTPException(status_code=400, detail="Tên phòng ban đã tồn tại")
    dept = Department(name=body.name, description=body.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name}


@router.patch("/departments/{dept_id}", summary="Cập nhật phòng ban", dependencies=[Depends(require_min_level(9))])
def update_department(dept_id: int, body: DepartmentUpdateRequest, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Phòng ban không tồn tại")
    if body.name is not None:
        existing = db.query(Department).filter(Department.name == body.name, Department.id != dept_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tên phòng ban đã tồn tại")
        dept.name = body.name
    if body.description is not None:
        dept.description = body.description
    db.commit()
    return {"ok": True}


@router.delete("/departments/{dept_id}", summary="Xóa phòng ban", status_code=204, dependencies=[Depends(require_min_level(9))])
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Phòng ban không tồn tại")
    user_count = db.query(User).filter(User.department_id == dept_id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Không thể xóa: còn {user_count} người dùng thuộc phòng ban này")
    db.delete(dept)
    db.commit()


@router.get("/departments/{dept_id}/users", summary="Nhân viên trong phòng ban")
def list_department_users(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Phòng ban không tồn tại")
    users = db.query(User).filter(User.department_id == dept_id).all()
    return {
        "department": {"id": dept.id, "name": dept.name, "description": dept.description},
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role.name if u.role else None,
                "role_id": u.role_id,
                "is_active": u.is_active,
                "last_login": str(u.last_login) if u.last_login else None,
                "avatar_url": u.avatar_url,
            }
            for u in users
        ],
    }


# ─────────────────────────────────────────────
# 10. Permissions – bulk read/write
# ─────────────────────────────────────────────
class PermissionItem(BaseModel):
    role_id: int
    category_id: int
    can_view: bool = True
    can_upload: bool = False
    can_delete: bool = False


@router.get("/permissions", summary="Lấy toàn bộ phân quyền")
def list_permissions(db: Session = Depends(get_db)):
    perms = db.query(CategoryPermission).all()
    return [
        {
            "id": p.id,
            "role_id": p.role_id,
            "category_id": p.category_id,
            "can_view": p.can_view,
            "can_upload": p.can_upload,
            "can_delete": p.can_delete,
        }
        for p in perms
    ]


@router.put("/permissions", summary="Lưu bulk permission matrix")
def save_permissions(items: list[PermissionItem], db: Session = Depends(get_db)):
    for item in items:
        perm = (
            db.query(CategoryPermission)
            .filter(CategoryPermission.role_id == item.role_id, CategoryPermission.category_id == item.category_id)
            .first()
        )
        if perm:
            perm.can_view = item.can_view
            perm.can_upload = item.can_upload
            perm.can_delete = item.can_delete
        else:
            db.add(CategoryPermission(
                role_id=item.role_id,
                category_id=item.category_id,
                can_view=item.can_view,
                can_upload=item.can_upload,
                can_delete=item.can_delete,
            ))
    db.commit()
    return {"ok": True, "updated": len(items)}


# ─────────────────────────────────────────────
# 11. Doc-level permissions – UserDocPermission
# ─────────────────────────────────────────────

@router.get("/doc-permissions/users", summary="Danh sách user kèm số doc được phép")
def list_doc_perm_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role_id != None).all()
    result = []
    for u in users:
        doc_count = db.query(UserDocPermission).filter(UserDocPermission.user_id == u.id).count()
        result.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "department": u.department.name if u.department else None,
            "department_id": u.department_id,
            "role": u.role.name if u.role else None,
            "doc_count": doc_count,
        })
    return result


@router.get("/doc-permissions/documents", summary="Tài liệu COMPANY kèm category")
def list_doc_perm_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.document_scope == "COMPANY").all()
    result = []
    for d in docs:
        user_count = db.query(UserDocPermission).filter(UserDocPermission.document_id == d.id).count()
        result.append({
            "id": d.id,
            "title": d.title,
            "category_id": d.category_id,
            "category_name": d.category.name if d.category else None,
            "file_size_bytes": d.file_size_bytes,
            "ingestion_status": d.ingestion_status,
            "user_count": user_count,
        })
    return result


@router.get("/doc-permissions", summary="Lấy doc_ids được phép của một user")
def get_user_doc_permissions(user_id: int, db: Session = Depends(get_db)):
    perms = db.query(UserDocPermission).filter(UserDocPermission.user_id == user_id).all()
    return {"user_id": user_id, "doc_ids": [p.document_id for p in perms]}


class DocPermSaveRequest(BaseModel):
    user_id: int
    doc_ids: list[int]


@router.put("/doc-permissions", summary="Lưu danh sách doc được phép cho một user")
def save_user_doc_permissions(body: DocPermSaveRequest, db: Session = Depends(get_db)):
    db.query(UserDocPermission).filter(UserDocPermission.user_id == body.user_id).delete()
    for doc_id in body.doc_ids:
        db.add(UserDocPermission(user_id=body.user_id, document_id=doc_id))
    db.commit()
    return {"ok": True, "user_id": body.user_id, "doc_count": len(body.doc_ids)}


# ─────────────────────────────────────────────
# 11b. Phân quyền tài liệu theo Phòng ban
# ─────────────────────────────────────────────

@router.get("/dept-doc-permissions/departments", summary="Phòng ban kèm số doc được phép")
def list_dept_perm_departments(db: Session = Depends(get_db)):
    from app.models.user_model import Department
    depts = db.query(Department).order_by(Department.name).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "user_count": db.query(User).filter(User.department_id == d.id).count(),
            "doc_count": db.query(DepartmentDocPermission).filter(DepartmentDocPermission.department_id == d.id).count(),
        }
        for d in depts
    ]


@router.get("/dept-doc-permissions/documents", summary="Tài liệu COMPANY kèm category")
def list_dept_perm_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.document_scope == "COMPANY").all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "category_id": d.category_id,
            "category_name": d.category.name if d.category else None,
            "file_size_bytes": d.file_size_bytes,
            "ingestion_status": d.ingestion_status,
        }
        for d in docs
    ]


@router.get("/dept-doc-permissions", summary="Lấy doc_ids được phép của một phòng ban")
def get_dept_doc_permissions(department_id: int, db: Session = Depends(get_db)):
    perms = db.query(DepartmentDocPermission).filter(
        DepartmentDocPermission.department_id == department_id
    ).all()
    return {"department_id": department_id, "doc_ids": [p.document_id for p in perms]}


class DeptDocPermSaveRequest(BaseModel):
    department_id: int
    doc_ids: list[int]


@router.put("/dept-doc-permissions", summary="Lưu danh sách doc được phép cho một phòng ban")
def save_dept_doc_permissions(body: DeptDocPermSaveRequest, db: Session = Depends(get_db)):
    db.query(DepartmentDocPermission).filter(
        DepartmentDocPermission.department_id == body.department_id
    ).delete()
    for doc_id in body.doc_ids:
        db.add(DepartmentDocPermission(department_id=body.department_id, document_id=doc_id))
    db.commit()
    return {"ok": True, "department_id": body.department_id, "doc_count": len(body.doc_ids)}


# ─────────────────────────────────────────────
# 12. AI Config – LlmConfig + SystemPrompts
# ─────────────────────────────────────────────
class LlmConfigUpdateRequest(BaseModel):
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    context_window_limit: Optional[int] = None
    max_new_tokens: Optional[int] = None


class SystemPromptUpdateRequest(BaseModel):
    prompt_content: str


@router.get("/ai-config", summary="Đọc cấu hình LLM hiện tại")
def get_ai_config(db: Session = Depends(get_db)):
    cfg = db.query(LlmConfig).filter(LlmConfig.is_active == True).first()
    if not cfg:
        return {"active": False}
    return {
        "id": cfg.id,
        "model_name": cfg.model_name,
        "temperature": cfg.temperature,
        "context_window_limit": cfg.context_window_limit,
        "max_new_tokens": cfg.max_new_tokens,
        "is_active": cfg.is_active,
        "updated_at": str(cfg.updated_at),
    }


@router.put("/ai-config", summary="Lưu cấu hình LLM")
def update_ai_config(body: LlmConfigUpdateRequest, db: Session = Depends(get_db)):
    cfg = db.query(LlmConfig).filter(LlmConfig.is_active == True).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Chưa có cấu hình LLM")
    if body.model_name is not None:
        cfg.model_name = body.model_name
    if body.temperature is not None:
        cfg.temperature = body.temperature
    if body.context_window_limit is not None:
        cfg.context_window_limit = body.context_window_limit
    if body.max_new_tokens is not None:
        cfg.max_new_tokens = body.max_new_tokens
    db.commit()
    return {"ok": True}


@router.post("/ai-config/test-connection", summary="Kiểm tra kết nối Ollama")
def test_ollama_connection():
    try:
        resp = http_requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            return {"online": True, "url": settings.OLLAMA_BASE_URL}
        return {"online": False, "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"online": False, "detail": str(e)}


@router.get("/system-prompts", summary="Danh sách system prompts")
def list_system_prompts(db: Session = Depends(get_db)):
    prompts = db.query(SystemPrompt).order_by(SystemPrompt.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "version_name": p.version_name,
            "description": p.description,
            "prompt_content": p.prompt_content,
            "is_active": p.is_active,
            "created_at": str(p.created_at),
        }
        for p in prompts
    ]


@router.put("/system-prompts/{prompt_id}", summary="Cập nhật nội dung system prompt")
def update_system_prompt(prompt_id: int, body: SystemPromptUpdateRequest, db: Session = Depends(get_db)):
    prompt = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt không tồn tại")
    prompt.prompt_content = body.prompt_content
    db.commit()
    return {"ok": True}


@router.post("/system-prompts/{prompt_id}/activate", summary="Kích hoạt system prompt")
def activate_system_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(SystemPrompt).filter(SystemPrompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt không tồn tại")
    db.query(SystemPrompt).update({"is_active": False})
    prompt.is_active = True
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
# 12. Chat Monitor – tất cả sessions (admin)
# ─────────────────────────────────────────────
@router.get("/chat/sessions", summary="Tất cả phiên chat")
def list_all_sessions(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .order_by(ChatSession.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    total = db.query(ChatSession).count()
    return {
        "total": total,
        "items": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "session_title": s.session_title,
                "is_archived": s.is_archived,
                "message_count": db.query(Message).filter(Message.session_id == s.id).count(),
                "created_at": str(s.created_at),
            }
            for s in sessions
        ],
    }


@router.get("/chat/sessions/{session_id}/messages", summary="Tin nhắn của phiên chat")
def get_session_messages(session_id: int, db: Session = Depends(get_db)):
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at)
        .all()
    )
    return [
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "content": m.content,
            "prompt_tokens": m.prompt_tokens,
            "completion_tokens": m.completion_tokens,
            "latency_ms": m.latency_ms,
            "created_at": str(m.created_at),
        }
        for m in messages
    ]


# ─────────────────────────────────────────────
# 13. Feedback – toàn hệ thống
# ─────────────────────────────────────────────
@router.get("/feedback", summary="Tất cả phản hồi người dùng")
def list_all_feedback(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    feedbacks = (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    total = db.query(Feedback).count()
    return {
        "total": total,
        "items": [
            {
                "id": f.id,
                "message_id": f.message_id,
                "reaction": f.reaction,
                "user_comment": f.user_comment,
                "corrected_text": f.corrected_text,
                "created_at": str(f.created_at),
            }
            for f in feedbacks
        ],
    }


# ─────────────────────────────────────────────
# 14. Audit Logs
# ─────────────────────────────────────────────
@router.get("/audit-logs", summary="Nhật ký hoạt động hệ thống")
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action: Optional[str] = None,
    username: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.filter(AuditLog.action == action)
    if username:
        q = q.filter(AuditLog.username.ilike(f"%{username}%"))
    total = q.count()
    logs = q.offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "username": log.username,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "details": _json.loads(log.details_json) if log.details_json else None,
                "ip_address": log.ip_address,
                "created_at": str(log.created_at),
            }
            for log in logs
        ],
    }
