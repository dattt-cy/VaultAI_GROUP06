import json as _json
from sqlalchemy.orm import Session
from app.models.sys_model import AuditLog


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
