"""
Admin Router – /api/admin/*
Logic đã được tách vào:
  - admin_system.py      — Overview, Documents, Chroma, AI Config, System Prompts, Audit Logs
  - admin_users.py       — Users, Roles, Departments CRUD
  - admin_permissions.py — Categories, Permissions, Doc/Dept permissions
  - admin_monitor.py     — Chat monitor, Feedback
  - admin_utils.py       — write_audit_log helper
"""
from fastapi import APIRouter
from app.api.routes.admin_utils import write_audit_log as write_audit_log  # noqa: F401 — re-export

router = APIRouter()
