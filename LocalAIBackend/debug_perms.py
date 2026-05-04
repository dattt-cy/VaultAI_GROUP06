import os
import sys
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from sqlalchemy import text

def debug_db():
    db = SessionLocal()
    try:
        # Check users
        print("--- USERS ---")
        users = db.execute(text("SELECT id, username, role_id, department_id FROM users")).fetchall()
        for u in users:
            print(dict(u._mapping))
            
        # Check roles
        print("\n--- ROLES ---")
        roles = db.execute(text("SELECT id, name FROM roles")).fetchall()
        for r in roles:
            print(dict(r._mapping))
            
        # Check category permissions
        print("\n--- CATEGORY PERMISSIONS ---")
        perms = db.execute(text("SELECT role_id, category_id, can_view FROM category_permissions")).fetchall()
        for p in perms:
            print(dict(p._mapping))
            
        # Check department doc permissions
        print("\n--- DEPT DOC PERMISSIONS ---")
        ddp = db.execute(text("SELECT department_id, document_id FROM department_doc_permissions")).fetchall()
        for p in ddp:
            print(dict(p._mapping))
            
        # Check user doc permissions
        print("\n--- USER DOC PERMISSIONS ---")
        udp = db.execute(text("SELECT user_id, document_id FROM user_doc_permissions")).fetchall()
        for p in udp:
            print(dict(p._mapping))
            
    finally:
        db.close()

if __name__ == "__main__":
    debug_db()
