from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.crud.crud_user import authenticate_user
from app.models.doc_model import CategoryPermission

router = APIRouter()

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


class LoginRequest(BaseModel):
    username: str
    password: str


def _build_user_response(user, db: Session) -> dict:
    perms = db.query(CategoryPermission).filter(
        CategoryPermission.role_id == user.role_id
    ).all()
    return {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.name,
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
    }


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
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

    return _build_user_response(user, db)


@router.get("/me")
def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return _build_user_response(current_user, db)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"success": True}
