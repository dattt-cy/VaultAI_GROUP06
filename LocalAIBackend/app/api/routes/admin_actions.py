"""Admin – Action-based permission management."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_min_level
from app.core.actions import ACTIONS, ACTION_GROUPS, ActionDef
from app.models.user_model import Role, RoleAction

router = APIRouter()


# ─────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────
class ActionPermissionItem(BaseModel):
    action_key: str
    allowed: bool


class SaveRoleActionsRequest(BaseModel):
    permissions: list[ActionPermissionItem]


# ─────────────────────────────────────────────
# GET /actions — toàn bộ action registry
# ─────────────────────────────────────────────
@router.get("/actions", summary="Danh sách action registry", dependencies=[Depends(require_min_level(9))])
def list_actions():
    """Trả về toàn bộ action registry gom theo nhóm."""
    groups: dict[str, list[dict]] = {g: [] for g in ACTION_GROUPS}
    for a in ACTIONS:
        groups[a.group].append({
            "key": a.key,
            "label": a.label,
            "description": a.description,
            "default_min_level": a.default_min_level,
        })
    return {
        "groups": [
            {"name": g, "actions": groups[g]}
            for g in ACTION_GROUPS
        ]
    }


# ─────────────────────────────────────────────
# GET /actions/roles/{role_id} — quyền của một role
# ─────────────────────────────────────────────
@router.get("/actions/roles/{role_id}", summary="Quyền action của một vai trò", dependencies=[Depends(require_min_level(9))])
def get_role_actions(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Vai trò không tồn tại")

    # Build map từ DB
    saved: dict[str, bool] = {
        ra.action_key: ra.allowed
        for ra in db.query(RoleAction).filter(RoleAction.role_id == role_id).all()
    }

    # Merge với defaults: nếu chưa có row → dùng default_min_level
    result: dict[str, bool] = {}
    for a in ACTIONS:
        if a.key in saved:
            result[a.key] = saved[a.key]
        else:
            # Mặc định: allowed nếu role.access_level >= default_min_level
            result[a.key] = role.access_level >= a.default_min_level

    return {
        "role_id": role_id,
        "role_name": role.name,
        "access_level": role.access_level,
        "permissions": result,
    }


# ─────────────────────────────────────────────
# PUT /actions/roles/{role_id} — lưu bulk quyền
# ─────────────────────────────────────────────
@router.put("/actions/roles/{role_id}", summary="Lưu quyền action cho vai trò", dependencies=[Depends(require_min_level(10))])
def save_role_actions(role_id: int, body: SaveRoleActionsRequest, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Vai trò không tồn tại")

    valid_keys = {a.key for a in ACTIONS}

    for item in body.permissions:
        if item.action_key not in valid_keys:
            continue
        existing = (
            db.query(RoleAction)
            .filter(RoleAction.role_id == role_id, RoleAction.action_key == item.action_key)
            .first()
        )
        if existing:
            existing.allowed = item.allowed
        else:
            db.add(RoleAction(role_id=role_id, action_key=item.action_key, allowed=item.allowed))

    db.commit()
    return {"ok": True, "role_id": role_id, "updated": len(body.permissions)}


# ─────────────────────────────────────────────
# GET /actions/matrix — tất cả roles × actions (dùng cho overview)
# ─────────────────────────────────────────────
@router.get("/actions/matrix", summary="Ma trận quyền của tất cả vai trò", dependencies=[Depends(require_min_level(9))])
def get_actions_matrix(db: Session = Depends(get_db)):
    roles = db.query(Role).order_by(Role.access_level.desc()).all()
    all_saved: list[RoleAction] = db.query(RoleAction).all()

    # role_id → {action_key: allowed}
    saved_map: dict[int, dict[str, bool]] = {}
    for ra in all_saved:
        saved_map.setdefault(ra.role_id, {})[ra.action_key] = ra.allowed

    result = []
    for role in roles:
        perms: dict[str, bool] = {}
        for a in ACTIONS:
            if role.name == "admin":
                perms[a.key] = True
            elif a.key in saved_map.get(role.id, {}):
                perms[a.key] = saved_map[role.id][a.key]
            else:
                perms[a.key] = role.access_level >= a.default_min_level
        result.append({
            "role_id": role.id,
            "role_name": role.name,
            "access_level": role.access_level,
            "permissions": perms,
        })

    return {"roles": result}
