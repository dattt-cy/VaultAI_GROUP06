"""Admin – Categories, Role Permissions, User/Dept Doc Permissions."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import require_action
from app.db.session import get_db
from app.models.doc_model import (
    Category,
    CategoryPermission,
    DepartmentDocPermission,
    Document,
    UserDocPermission,
)
from app.models.user_model import Department, User

router = APIRouter()


# ─────────────────────────────────────────────
# Categories
# ─────────────────────────────────────────────
class CategoryCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/categories", summary="Danh sách danh mục", dependencies=[Depends(require_action("admin.categories.manage"))])
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


@router.post("/categories", summary="Tạo danh mục mới", status_code=201, dependencies=[Depends(require_action("admin.categories.manage"))])
def create_category(body: CategoryCreateRequest, db: Session = Depends(get_db)):
    cat = Category(name=body.name, description=body.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name}


@router.patch("/categories/{cat_id}", summary="Cập nhật danh mục", dependencies=[Depends(require_action("admin.categories.manage"))])
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


@router.delete("/categories/{cat_id}", summary="Xóa danh mục", status_code=204, dependencies=[Depends(require_action("admin.categories.manage"))])
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
# Role-Category Permissions (permission matrix)
# ─────────────────────────────────────────────
class PermissionItem(BaseModel):
    role_id: int
    category_id: int
    can_view: bool = True
    can_upload: bool = False
    can_delete: bool = False


@router.get("/permissions", summary="Lấy toàn bộ phân quyền", dependencies=[Depends(require_action("admin.permissions.view"))])
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


@router.put("/permissions", summary="Lưu bulk permission matrix", dependencies=[Depends(require_action("admin.permissions.edit"))])
def save_permissions(items: list[PermissionItem], db: Session = Depends(get_db)):
    for item in items:
        perm = (
            db.query(CategoryPermission)
            .filter(
                CategoryPermission.role_id == item.role_id,
                CategoryPermission.category_id == item.category_id,
            )
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
# User-level Doc Permissions
# ─────────────────────────────────────────────
class DocPermSaveRequest(BaseModel):
    user_id: int
    doc_ids: list[int]


@router.get("/doc-permissions/users", summary="Danh sách user kèm số doc được phép", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def list_doc_perm_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role_id != None).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "department": u.department.name if u.department else None,
            "department_id": u.department_id,
            "role": u.role.name if u.role else None,
            "doc_count": db.query(UserDocPermission).filter(UserDocPermission.user_id == u.id).count(),
        }
        for u in users
    ]


@router.get("/doc-permissions/documents", summary="Tài liệu COMPANY kèm category", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def list_doc_perm_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.document_scope == "COMPANY").all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "category_id": d.category_id,
            "category_name": d.category.name if d.category else None,
            "file_size_bytes": d.file_size_bytes,
            "ingestion_status": d.ingestion_status,
            "user_count": db.query(UserDocPermission).filter(UserDocPermission.document_id == d.id).count(),
        }
        for d in docs
    ]


@router.get("/doc-permissions", summary="Lấy doc_ids được phép của một user", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def get_user_doc_permissions(user_id: int, db: Session = Depends(get_db)):
    perms = db.query(UserDocPermission).filter(UserDocPermission.user_id == user_id).all()
    return {"user_id": user_id, "doc_ids": [p.document_id for p in perms]}


@router.put("/doc-permissions", summary="Lưu danh sách doc được phép cho một user", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def save_user_doc_permissions(body: DocPermSaveRequest, db: Session = Depends(get_db)):
    db.query(UserDocPermission).filter(UserDocPermission.user_id == body.user_id).delete()
    for doc_id in body.doc_ids:
        db.add(UserDocPermission(user_id=body.user_id, document_id=doc_id))
    db.commit()
    return {"ok": True, "user_id": body.user_id, "doc_count": len(body.doc_ids)}


# ─────────────────────────────────────────────
# Department-level Doc Permissions
# ─────────────────────────────────────────────
class DeptDocPermSaveRequest(BaseModel):
    department_id: int
    doc_ids: list[int]


@router.get("/dept-doc-permissions/departments", summary="Phòng ban kèm số doc được phép", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def list_dept_perm_departments(db: Session = Depends(get_db)):
    depts = db.query(Department).order_by(Department.name).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "user_count": db.query(User).filter(User.department_id == d.id).count(),
            "doc_count": db.query(DepartmentDocPermission).filter(
                DepartmentDocPermission.department_id == d.id
            ).count(),
        }
        for d in depts
    ]


@router.get("/dept-doc-permissions/documents", summary="Tài liệu COMPANY kèm category", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
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


@router.get("/dept-doc-permissions", summary="Lấy doc_ids được phép của một phòng ban", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def get_dept_doc_permissions(department_id: int, db: Session = Depends(get_db)):
    perms = db.query(DepartmentDocPermission).filter(
        DepartmentDocPermission.department_id == department_id
    ).all()
    return {"department_id": department_id, "doc_ids": [p.document_id for p in perms]}


@router.put("/dept-doc-permissions", summary="Lưu danh sách doc được phép cho một phòng ban", dependencies=[Depends(require_action("admin.doc_perm.manage"))])
def save_dept_doc_permissions(body: DeptDocPermSaveRequest, db: Session = Depends(get_db)):
    db.query(DepartmentDocPermission).filter(
        DepartmentDocPermission.department_id == body.department_id
    ).delete()
    for doc_id in body.doc_ids:
        db.add(DepartmentDocPermission(department_id=body.department_id, document_id=doc_id))
    db.commit()
    return {"ok": True, "department_id": body.department_id, "doc_count": len(body.doc_ids)}
