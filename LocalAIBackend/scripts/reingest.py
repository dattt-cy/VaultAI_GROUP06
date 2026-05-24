"""
Re-ingest tất cả tài liệu đã có trong DB bằng pipeline parent-child mới.

Quy trình:
1. Xóa ChromaDB collection
2. Xóa tất cả document_pages trong MySQL
3. Re-chunk từng document (parent-child) và lưu lại
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models import user_model, doc_model, chat_model, sys_model  # noqa: F401 — register ORM relationships
from app.models.doc_model import Document, DocumentPage
from app.services.ingestion_service import (
    _extract_text,
    _ingest_pdf,
    _save_parent_child_chunks,
)
from app.services.document_parser import chunk_text_parent_child
from app.services.vector_store import add_documents_to_store
import app.services.vector_store as vs_module
from app.crud.crud_document import update_document_status


def _clear_vector_store():
    print("Xóa ChromaDB collection...")
    vs = vs_module.get_vector_store()
    try:
        vs.delete_collection()
        print("ChromaDB collection đã xóa.")
    except Exception as e:
        print(f"Lỗi khi xóa ChromaDB: {e}")
    finally:
        vs_module._vector_store = None


def reingest_all():
    _clear_vector_store()

    db: Session = SessionLocal()
    docs = db.query(Document).filter(
        Document.ingestion_status.in_(["SUCCESS", "FAILED"])
    ).all()
    print(f"Tìm thấy {len(docs)} tài liệu cần re-ingest.\n")

    success = 0
    failed = 0

    for doc in docs:
        print(f"[{doc.id}] {doc.title} ({doc.file_type})")

        # Tìm file trên disk
        file_path = doc.file_path
        if not os.path.exists(file_path):
            alt = os.path.join(os.path.dirname(__file__), "sample_docs", os.path.basename(file_path))
            if os.path.exists(alt):
                file_path = alt
                doc.file_path = alt
                db.commit()
            else:
                print(f"  ✗ Không tìm thấy file: {file_path}")
                update_document_status(db, doc, "FAILED", error="File not found")
                failed += 1
                continue

        # Xóa chunks cũ trong MySQL
        db.query(DocumentPage).filter(DocumentPage.document_id == doc.id).delete()
        db.commit()

        try:
            update_document_status(db, doc, "PROCESSING")

            ft = doc.file_type.lower()
            if ft == "pdf":
                chunks = _ingest_pdf(file_path, doc.title)
            else:
                text = _extract_text(file_path, doc.file_type)
                if not text.strip():
                    raise ValueError("File không có nội dung văn bản")
                chunks = chunk_text_parent_child(text)

            if not chunks:
                raise ValueError("Không tạo được chunk nào")

            documents_for_vector: list = []
            metadatas_for_vector: list = []
            chroma_ids_input: list = []

            total_tokens = _save_parent_child_chunks(
                db=db,
                chunks=chunks,
                db_doc=doc,
                filename=doc.title,
                documents_for_vector=documents_for_vector,
                metadatas_for_vector=metadatas_for_vector,
                chroma_ids_input=chroma_ids_input,
            )

            if documents_for_vector:
                add_documents_to_store(
                    texts=documents_for_vector,
                    metadatas=metadatas_for_vector,
                    ids=chroma_ids_input,
                )

            n_parents = sum(1 for c in chunks if c["chunk_type"] == "parent")
            n_children = sum(1 for c in chunks if c["chunk_type"] == "child")
            update_document_status(db, doc, "SUCCESS", total_tokens=total_tokens)
            print(f"  ✓ {n_parents} parents, {n_children} children, {total_tokens} tokens")
            success += 1

        except Exception as e:
            update_document_status(db, doc, "FAILED", error=str(e))
            print(f"  ✗ Lỗi: {e}")
            failed += 1

    db.close()
    print(f"\nHoàn tất: {success} thành công, {failed} thất bại.")


if __name__ == "__main__":
    reingest_all()
