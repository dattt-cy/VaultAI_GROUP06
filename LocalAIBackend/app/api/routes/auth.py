from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from fastapi import Request

from app.api.dependencies import get_db, get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.crud.crud_user import authenticate_user
from app.models.doc_model import CategoryPermission
from app.models.user_model import RoleAction
from app.core.actions import ACTIONS
from app.api.routes.admin import write_audit_log

router = APIRouter()

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


class LoginRequest(BaseModel):
    username: str
    password: str


def _build_action_permissions(user, db: Session) -> dict[str, bool]:
    """Tính toán effective action permissions cho user."""
    if user.role.name == "admin":
        return {a.key: True for a in ACTIONS}

    saved: dict[str, bool] = {
        ra.action_key: ra.allowed
        for ra in db.query(RoleAction).filter(RoleAction.role_id == user.role_id).all()
    }
    return {
        a.key: saved[a.key] if a.key in saved else user.role.access_level >= a.default_min_level
        for a in ACTIONS
    }


def _build_user_response(user, db: Session) -> dict:
    perms = db.query(CategoryPermission).filter(
        CategoryPermission.role_id == user.role_id
    ).all()
    return {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.name,
        "access_level": user.role.access_level,
        "department": user.department,
        "category_permissions": [
            {
                "category_id": p.category_id,
                "can_view": p.can_view,
                "can_upload": p.can_upload,
                "can_delete": p.can_delete,
            }
            for p in perms
        ],
        "action_permissions": _build_action_permissions(user, db),
    }


@router.post("/login")
def login(body: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    token = create_access_token(subject=user.id, role=user.role.name)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )

    user.last_login = datetime.utcnow()
    db.commit()

    write_audit_log(
        db, action="LOGIN",
        username=user.username, user_id=user.id,
        details={"browser": request.headers.get("user-agent", "")[:80]},
        ip_address=request.client.host if request.client else None,
    )

    return _build_user_response(user, db)


@router.get("/me")
def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return _build_user_response(current_user, db)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"success": True}
