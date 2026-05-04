"""
migrate_add_parent_child.py
===========================
Thêm 3 cột mới vào bảng document_pages cho parent-child chunking.
Chạy 1 lần duy nhất trước khi fresh_ingest.py.

Chạy: python migrate_add_parent_child.py
"""

import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import text
from app.db.session import SessionLocal

MIGRATIONS = [
    "ALTER TABLE document_pages ADD COLUMN chunk_type TEXT NOT NULL DEFAULT 'flat'",
    "ALTER TABLE document_pages ADD COLUMN parent_chunk_id INTEGER REFERENCES document_pages(id) ON DELETE SET NULL",
    "ALTER TABLE document_pages ADD COLUMN child_count INTEGER",
    "CREATE INDEX IF NOT EXISTS ix_document_pages_parent_chunk_id ON document_pages(parent_chunk_id)",
    "CREATE INDEX IF NOT EXISTS ix_document_pages_chunk_type ON document_pages(chunk_type)",
]

if __name__ == "__main__":
    db = SessionLocal()
    try:
        for sql in MIGRATIONS:
            try:
                db.execute(text(sql))
                db.commit()
                print(f"  [OK] {sql[:60]}...")
            except Exception as e:
                db.rollback()
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"  [SKIP] Đã tồn tại: {sql[:60]}...")
                else:
                    print(f"  [FAIL] {e}")

        from app.models.doc_model import DocumentPage
        count = db.query(DocumentPage).count()
        print(f"\nMigration hoàn tất. Tổng rows hiện tại: {count}")
        print("Tiếp theo: python fresh_ingest.py")
    finally:
        db.close()
