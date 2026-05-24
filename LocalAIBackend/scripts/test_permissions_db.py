import os
import sys
# Thêm đường dẫn project
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.user_model import User
from app.api.routes.chat import _resolve_allowed_doc_ids

def test_permissions():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            print(f"Testing User: {user.username} (Role: {user.role.name if user.role else 'None'})")
            allowed = _resolve_allowed_doc_ids(db, user, None)
            print(f"Allowed doc ids: {allowed}")
            print("-" * 40)
    finally:
        db.close()

if __name__ == "__main__":
    test_permissions()
