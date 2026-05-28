from typing import Generator

from fastapi import Cookie, Depends, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user_model import User

COOKIE_NAME = "access_token"


def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_current_user(
    access_token: str = Cookie(None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Chưa đăng nhập")
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Không tìm thấy người dùng")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Admin")
    return current_user


def require_min_level(min_level: int):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.access_level < min_level:
            raise HTTPException(status_code=403, detail="Không đủ quyền truy cập")
        return current_user
    return checker


def _is_action_allowed(user: User, action_key: str, db: Session) -> bool:
    """
    Kiểm tra user có quyền thực hiện action_key không.
    Ưu tiên: admin → luôn True.
    Nếu có row RoleAction → dùng allowed field.
    Nếu không có row → fallback default_min_level từ registry.
    """
    if user.role.name == "admin":
        return True

    from app.models.user_model import RoleAction
    from app.core.actions import ACTION_MAP

    row = (
        db.query(RoleAction)
        .filter(RoleAction.role_id == user.role_id, RoleAction.action_key == action_key)
        .first()
    )
    if row is not None:
        return row.allowed

    # Fallback: default_min_level từ registry
    action_def = ACTION_MAP.get(action_key)
    if action_def is None:
        return False
    return user.role.access_level >= action_def.default_min_level


def require_action(action_key: str):
    """
    Dependency factory: kiểm tra action permission từ bảng RoleAction.
    Dùng thay thế / bổ sung cho require_min_level.
    """
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not _is_action_allowed(current_user, action_key, db):
            raise HTTPException(
                status_code=403,
                detail=f"Bạn không có quyền thực hiện thao tác này ({action_key})",
            )
        return current_user
    return checker
