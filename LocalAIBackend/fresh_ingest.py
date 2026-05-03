"""
fresh_ingest.py
===============
Xóa sạch toàn bộ dữ liệu cũ (Document, DocumentPage, ChromaDB, FTS)
rồi nạp lại toàn bộ file từ các thư mục danh mục bên dưới BASE_DIR.

Cấu trúc thư mục:
  nhan_su/           — Quy chế lao động, chính sách lương, kế hoạch
  tai_chinh/         — Báo cáo doanh thu, quy trình thanh toán
  cong_nghe/         — Hướng dẫn CNTT, ERP, bảo mật
  bao_cao_ky_thuat/  — Báo cáo kỹ thuật, tài liệu học thuật
  ca_nhan/           — Tài liệu cá nhân (personal_*)

Chạy: python fresh_ingest.py
"""

import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import text
from app.db.session import SessionLocal
from app.models import user_model, doc_model, chat_model, sys_model
from app.models.doc_model import Document, DocumentPage
from app.services.ingestion_service import ingest_file
import app.services.vector_store as vs_module

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DOC_FOLDERS = [
    "nhan_su",
    "tai_chinh",
    "cong_nghe",
    "bao_cao_ky_thuat",
    "ca_nhan",
]

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls"}
SYSTEM_USER_ID = 1
CATEGORY_ID = 1


def clear_all(db):
    print("── Xóa dữ liệu cũ ──")

    try:
        vs = vs_module.get_vector_store()
        vs.delete_collection()
        print("  [OK] ChromaDB collection đã xóa")
    except Exception as e:
        print(f"  [WARN] ChromaDB: {e}")
    finally:
        vs_module._vector_store = None

    try:
        db.execute(text("DELETE FROM document_pages_fts"))
        db.commit()
        print("  [OK] FTS5 index đã xóa")
    except Exception as e:
        db.rollback()
        print(f"  [WARN] FTS5: {e}")

    page_count = db.query(DocumentPage).delete()
    doc_count = db.query(Document).delete()
    db.commit()
    print(f"  [OK] Đã xóa {doc_count} documents, {page_count} pages khỏi SQLite")


def ingest_folder(db, folder_name):
    folder_path = os.path.join(BASE_DIR, folder_name)
    if not os.path.isdir(folder_path):
        print(f"\n  [SKIP] Thư mục không tồn tại: {folder_name}/")
        return 0, 0

    files = sorted(
        f for f in os.listdir(folder_path)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    )

    print(f"\n── [{folder_name}/] {len(files)} file ──")
    if not files:
        print("  Không có file nào.")
        return 0, 0

    success, failed = 0, 0
    for filename in files:
        file_path = os.path.join(folder_path, filename)
        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        print(f"  Nạp: {filename} ...", end=" ", flush=True)
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

    return success, failed


if __name__ == "__main__":
    db = SessionLocal()
    try:
        clear_all(db)

        total_ok, total_fail = 0, 0
        for folder in DOC_FOLDERS:
            ok, fail = ingest_folder(db, folder)
            total_ok += ok
            total_fail += fail

        print(f"\n{'─'*40}")
        print(f"Tổng kết: {total_ok} thành công, {total_fail} thất bại")
        print("Hoàn tất. Restart backend để áp dụng.")
    finally:
        db.close()
