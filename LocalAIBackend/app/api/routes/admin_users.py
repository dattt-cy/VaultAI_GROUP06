"""Admin – Users, Roles, Departments CRUD."""
import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import require_action
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.user_model import Department, Role, User

router = APIRouter()

AVATAR_DIR = os.path.join(os.path.dirname(__file__), "../../../../uploads/avatars")


# ─────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────
class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    department_id: Optional[int] = None
    role_id: int = 2


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None  # None means "remove from dept"
    role_id: Optional[int] = None
    password: Optional[str] = None


@router.get("/users", summary="Danh sách người dùng", dependencies=[Depends(require_action("admin.users.view"))])
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


@router.post("/users", summary="Tạo người dùng mới", status_code=201, dependencies=[Depends(require_action("admin.users.create"))])
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


@router.patch("/users/{user_id}", summary="Cập nhật thông tin người dùng", dependencies=[Depends(require_action("admin.users.edit"))])
def update_user(user_id: int, body: UserUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    sent = body.model_fields_set
    if "full_name" in sent and body.full_name is not None:
        user.full_name = body.full_name
    if "email" in sent:
        user.email = body.email
    if "department_id" in sent:
        user.department_id = body.department_id
    if "role_id" in sent and body.role_id is not None:
        user.role_id = body.role_id
    if "password" in sent and body.password is not None:
        user.password_hash = get_password_hash(body.password)
    db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/toggle-active", summary="Bật/tắt trạng thái người dùng", dependencies=[Depends(require_action("admin.users.toggle"))])
def toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.delete("/users/{user_id}", summary="Xóa người dùng", status_code=204, dependencies=[Depends(require_action("admin.users.delete"))])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    db.delete(user)
    db.commit()


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
# Roles
# ─────────────────────────────────────────────
class RoleCreateRequest(BaseModel):
    name: str
    access_level: int
    description: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    access_level: Optional[int] = None
    description: Optional[str] = None


@router.get("/roles", summary="Danh sách vai trò", dependencies=[Depends(require_action("admin.roles.view"))])
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


@router.post("/roles", summary="Tạo vai trò mới", status_code=201, dependencies=[Depends(require_action("admin.roles.create"))])
def create_role(body: RoleCreateRequest, db: Session = Depends(get_db)):
    role = Role(name=body.name, access_level=body.access_level, description=body.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"id": role.id, "name": role.name}


@router.patch("/roles/{role_id}", summary="Cập nhật vai trò", dependencies=[Depends(require_action("admin.roles.edit"))])
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


@router.delete("/roles/{role_id}", summary="Xóa vai trò", status_code=204, dependencies=[Depends(require_action("admin.roles.delete"))])
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
# Departments
# ─────────────────────────────────────────────
class DepartmentCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/departments", summary="Danh sách phòng ban", dependencies=[Depends(require_action("admin.departments.view"))])
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


@router.post("/departments", summary="Tạo phòng ban mới", status_code=201, dependencies=[Depends(require_action("admin.departments.create"))])
def create_department(body: DepartmentCreateRequest, db: Session = Depends(get_db)):
    if db.query(Department).filter(Department.name == body.name).first():
        raise HTTPException(status_code=400, detail="Tên phòng ban đã tồn tại")
    dept = Department(name=body.name, description=body.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name}


@router.patch("/departments/{dept_id}", summary="Cập nhật phòng ban", dependencies=[Depends(require_action("admin.departments.edit"))])
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


@router.delete("/departments/{dept_id}", summary="Xóa phòng ban", status_code=204, dependencies=[Depends(require_action("admin.departments.delete"))])
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
