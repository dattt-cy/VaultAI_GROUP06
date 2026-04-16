"""
Re-ingest Script
================
Xóa sạch toàn bộ documents + chunks cũ trong SQLite & ChromaDB,
sau đó ingest lại tất cả file trong uploads/ và seed_files/
để cập nhật metadata page_number mới.
"""
import os
import sys
import glob

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.user_model import User, Role
from app.models.doc_model import Category, Document, DocumentPage
from app.models.chat_model import ChatSession, Message
from app.services.ingestion_service import ingest_file


def reingest():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── BƯỚC 1: Xóa toàn bộ documents + pages cũ ──
        print("=" * 60)
        print("BƯỚC 1: Xóa toàn bộ documents cũ trong SQLite...")
        old_docs = db.query(Document).all()
        print(f"  Tìm thấy {len(old_docs)} documents cũ")
        for doc in old_docs:
            db.delete(doc)  # cascade sẽ xóa luôn DocumentPage
        db.commit()
        print("  ✓ Đã xóa toàn bộ documents + pages trong SQLite")

        # ── BƯỚC 2: Xóa ChromaDB collection ──
        print("\nBƯỚC 2: Reset ChromaDB collection...")
        try:
            import chromadb
            from app.core.config import settings
            client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            try:
                client.delete_collection("local_ai_documents")
                print("  ✓ Đã xóa collection 'local_ai_documents' trong ChromaDB")
            except Exception:
                print("  ✓ Collection chưa tồn tại, bỏ qua")
        except Exception as e:
            print(f"  ⚠ Lỗi reset ChromaDB: {e}")
            print("  → Thử xóa thủ công thư mục chroma_db/")

        # ── BƯỚC 3: Đảm bảo categories tồn tại ──
        print("\nBƯỚC 3: Kiểm tra categories...")
        cat_map = {}
        for cat_name in ["NHÂN SỰ", "TÀI CHÍNH", "IT", "Chung"]:
            cat = db.query(Category).filter_by(name=cat_name).first()
            if not cat:
                cat = Category(name=cat_name, description=f"Thư mục {cat_name}")
                db.add(cat)
                db.commit()
                db.refresh(cat)
            cat_map[cat_name] = cat.id
        print(f"  ✓ Categories: {list(cat_map.keys())}")

        # ── BƯỚC 4: Re-ingest seed files ──
        print("\nBƯỚC 4: Re-ingest seed files...")
        seed_dir = os.path.join(os.path.dirname(__file__), "seed_files")
        seed_files_meta = {
            "Quy_che_lao_dong_2024.txt": "NHÂN SỰ",
            "Chinh_sach_bao_hiem.txt": "NHÂN SỰ",
            "Bao_cao_doanh_thu_Q1.txt": "TÀI CHÍNH",
            "Huong_dan_bao_mat_IT.txt": "IT",
        }

        for fname, cat_name in seed_files_meta.items():
            fpath = os.path.join(seed_dir, fname)
            if os.path.exists(fpath):
                ext = fname.rsplit(".", 1)[-1].lower()
                doc = ingest_file(
                    db=db,
                    file_path=fpath,
                    filename=fname,
                    file_type=ext,
                    category_id=cat_map.get(cat_name, cat_map["Chung"]),
                    uploaded_by=1,
                )
                doc.document_scope = "COMPANY"
                db.commit()
                print(f"  ✓ {fname} → {cat_name}")
            else:
                print(f"  ⚠ Không tìm thấy: {fpath}")

        # ── BƯỚC 5: Re-ingest uploads/ ──
        print("\nBƯỚC 5: Re-ingest uploads/...")
        upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
        if os.path.exists(upload_dir):
            for fpath in glob.glob(os.path.join(upload_dir, "*")):
                if os.path.isfile(fpath):
                    fname = os.path.basename(fpath)
                    ext = fname.rsplit(".", 1)[-1].lower()
                    if ext in {"pdf", "txt", "doc", "docx", "xls", "xlsx"}:
                        doc = ingest_file(
                            db=db,
                            file_path=fpath,
                            filename=fname,
                            file_type=ext,
                            category_id=cat_map["Chung"],
                            uploaded_by=1,
                        )
                        doc.document_scope = "COMPANY"
                        db.commit()
                        print(f"  ✓ {fname} (PDF: page_number mới!)")
                    else:
                        print(f"  ⚠ Bỏ qua (không hỗ trợ): {fname}")

        # ── BƯỚC 6: Xác nhận ──
        print("\n" + "=" * 60)
        total_docs = db.query(Document).count()
        total_pages = db.query(DocumentPage).count()
        print(f"HOÀN TẤT! {total_docs} documents, {total_pages} chunks đã được re-ingest")
        print("page_number mới đã được cập nhật trong metadata.")
        print("=" * 60)

    except Exception as e:
        print(f"\nLỖI: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    reingest()
