"""
fresh_ingest.py
===============
Xóa sạch toàn bộ dữ liệu cũ (Document, DocumentPage, ChromaDB, FTS)
rồi nạp lại toàn bộ file trong thư mục sample_docs/.

Chạy: python fresh_ingest.py
"""

import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import text
from app.db.session import SessionLocal
from app.models import user_model, doc_model, chat_model, sys_model  # load all models để SQLAlchemy resolve FK
from app.models.doc_model import Document, DocumentPage
from app.services.ingestion_service import ingest_file
import app.services.vector_store as vs_module

SAMPLE_DOCS_DIR = os.path.join(os.path.dirname(__file__), "sample_docs")
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls"}
SYSTEM_USER_ID = 1   # user admin mặc định
CATEGORY_ID = 1


def clear_all(db):
    print("── Xóa dữ liệu cũ ──")

    # 1. Xóa ChromaDB collection
    try:
        vs = vs_module.get_vector_store()
        vs.delete_collection()
        print("  [OK] ChromaDB collection đã xóa")
    except Exception as e:
        print(f"  [WARN] ChromaDB: {e}")
    finally:
        vs_module._vector_store = None

    # 2. Xóa FTS index
    try:
        db.execute(text("DELETE FROM document_pages_fts"))
        db.commit()
        print("  [OK] FTS5 index đã xóa")
    except Exception as e:
        db.rollback()
        print(f"  [WARN] FTS5: {e}")

    # 3. Xóa DocumentPage rồi Document (tránh FK constraint)
    page_count = db.query(DocumentPage).delete()
    doc_count = db.query(Document).delete()
    db.commit()
    print(f"  [OK] Đã xóa {doc_count} documents, {page_count} pages khỏi SQLite")


def ingest_from_folder(db, folder):
    print(f"\n── Nạp tài liệu từ {folder} ──")

    files = [
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]

    if not files:
        print("  Không tìm thấy file nào để nạp.")
        return

    print(f"  Tìm thấy {len(files)} file: {', '.join(files)}\n")

    success, failed = 0, 0
    for filename in sorted(files):
        file_path = os.path.join(folder, filename)
        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        print(f"  Đang nạp: {filename} ...", end=" ", flush=True)
        try:
            ingest_file(
                db=db,
                file_path=file_path,
                filename=filename,
                file_type=ext,
                category_id=CATEGORY_ID,
                uploaded_by=SYSTEM_USER_ID,
                scope="COMPANY",
            )
            print("OK")
            success += 1
        except Exception as e:
            print(f"FAIL — {e}")
            failed += 1

    print(f"\n── Kết quả: {success} thành công, {failed} thất bại ──")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        clear_all(db)
        ingest_from_folder(db, SAMPLE_DOCS_DIR)
    finally:
        db.close()
    print("\nHoàn tất. Restart backend để áp dụng.")
