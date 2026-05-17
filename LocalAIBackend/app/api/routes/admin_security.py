"""
Admin Security Routes – /api/admin/security/*
Quản lý cài đặt bảo mật: session timeout, chính sách mật khẩu, active sessions.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
import datetime

from app.db.session import get_db
from app.api.dependencies import require_min_level, get_current_user
from app.models.user_model import User
from app.models.sys_model import AuditLog

router = APIRouter()

SECURITY_DEFAULTS = {
    "session_timeout_days": "8",
    "min_password_length": "8",
    "require_uppercase": "false",
    "require_number": "true",
    "require_special": "false",
    "max_login_attempts": "5",
    "lockout_duration_minutes": "15",
}


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS security_settings (
            `key` VARCHAR(100) PRIMARY KEY,
            `value` TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """))
    db.commit()


def _get_all_settings(db: Session) -> dict:
    _ensure_table(db)
    rows = db.execute(text("SELECT `key`, `value` FROM security_settings")).fetchall()
    stored = {r[0]: r[1] for r in rows}
    result = {}
    for k, default in SECURITY_DEFAULTS.items():
        result[k] = stored.get(k, default)
    return result


def _set_setting(db: Session, key: str, value: str):
    db.execute(text("""
        INSERT INTO security_settings (`key`, `value`) VALUES (:k, :v)
        ON DUPLICATE KEY UPDATE `value` = :v, updated_at = NOW()
    """), {"k": key, "v": value})
    db.commit()


class SecuritySettingsUpdate(BaseModel):
    session_timeout_days: Optional[int] = None
    min_password_length: Optional[int] = None
    require_uppercase: Optional[bool] = None
    require_number: Optional[bool] = None
    require_special: Optional[bool] = None
    max_login_attempts: Optional[int] = None
    lockout_duration_minutes: Optional[int] = None


# ─────────────────────────────────────────────
# GET /security/settings
# ─────────────────────────────────────────────
@router.get("/security/settings", summary="Lấy cài đặt bảo mật", dependencies=[Depends(require_min_level(9))])
def get_security_settings(db: Session = Depends(get_db)):
    cfg = _get_all_settings(db)
    return {
        "session_timeout_days": int(cfg["session_timeout_days"]),
        "min_password_length": int(cfg["min_password_length"]),
        "require_uppercase": cfg["require_uppercase"] == "true",
        "require_number": cfg["require_number"] == "true",
        "require_special": cfg["require_special"] == "true",
        "max_login_attempts": int(cfg["max_login_attempts"]),
        "lockout_duration_minutes": int(cfg["lockout_duration_minutes"]),
    }


# ─────────────────────────────────────────────
# PUT /security/settings
# ─────────────────────────────────────────────
@router.put("/security/settings", summary="Cập nhật cài đặt bảo mật", dependencies=[Depends(require_min_level(9))])
def update_security_settings(body: SecuritySettingsUpdate, db: Session = Depends(get_db)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Không có thay đổi nào.")
    for k, v in updates.items():
        _set_setting(db, k, str(v).lower() if isinstance(v, bool) else str(v))
    return {"message": "Cài đặt bảo mật đã được cập nhật.", "updated": list(updates.keys())}


# ─────────────────────────────────────────────
# GET /security/active-sessions
# Lấy danh sách user đã login gần đây từ audit log
# ─────────────────────────────────────────────
@router.get("/security/active-sessions", summary="Phiên đăng nhập gần đây", dependencies=[Depends(require_min_level(9))])
def get_active_sessions(db: Session = Depends(get_db)):
    # Lấy login events trong 8 ngày gần nhất (mặc định session timeout)
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=8)
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.action == "LOGIN", AuditLog.created_at >= cutoff)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )

    # Nhóm theo user_id, giữ login mới nhất
    seen = {}
    for log in logs:
        uid = log.user_id
        if uid and uid not in seen:
            user = db.query(User).filter(User.id == uid).first()
            seen[uid] = {
                "user_id": uid,
                "username": log.username,
                "full_name": user.full_name if user else log.username,
                "ip_address": log.ip_address,
                "last_login": log.created_at.isoformat() if log.created_at else None,
                "is_active": user.is_active if user else True,
            }

    sessions = list(seen.values())
    sessions.sort(key=lambda x: x["last_login"] or "", reverse=True)
    return {"sessions": sessions, "total": len(sessions)}


# ─────────────────────────────────────────────
# DELETE /security/sessions/{user_id} — force logout (disable user session)
# ─────────────────────────────────────────────
@router.delete(
    "/security/sessions/{user_id}",
    summary="Force logout user",
    dependencies=[Depends(require_min_level(9))],
)
def force_logout_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể force logout chính mình.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại.")

    # Ghi audit log — JWT stateless nên không thể revoke token trực tiếp,
    # nhưng ghi nhận hành động admin. Admin có thể disable account nếu cần.
    from app.models.sys_model import AuditLog as AL
    import json
    log = AL(
        user_id=current_user.id,
        username=current_user.username,
        action="FORCE_LOGOUT",
        entity_type="user",
        entity_id=str(user_id),
        details_json=json.dumps({"target_username": user.username}),
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Đã ghi nhận force logout cho user '{user.username}'. Token hiện tại sẽ hết hạn tự nhiên.",
        "user_id": user_id,
    }
