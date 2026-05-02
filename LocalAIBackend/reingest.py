import os
import sys

# Thêm đường dẫn thư mục gốc vào sys.path để import app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models import user_model, doc_model, chat_model, sys_model
from app.models.doc_model import Document, DocumentPage
from app.services.vector_store import get_vector_store
from app.services.ingestion_service import _extract_text, _ingest_pdf, chunk_text
from app.services.vector_store import add_documents_to_store
from app.schemas.doc_schema import DocumentPageCreate
from app.crud.crud_document import create_document_page, update_document_status
from app.services.hybrid_retriever import sync_page_to_fts
import json
import uuid

def clear_vector_store():
    print("Clearing ChromaDB collection...")
    from app.services.vector_store import get_vector_store
    import app.services.vector_store as vs_module
    vs = get_vector_store()
    try:
        # Cách an toàn để clear collection
        vs.delete_collection()
        print("ChromaDB collection deleted.")
    except Exception as e:
        print(f"Error clearing ChromaDB: {e}")
    finally:
        # Quan trọng: Reset lại biến singleton để tạo lại collection mới
        vs_module._vector_store = None

def reingest_all():
    clear_vector_store()

    db = SessionLocal()
    docs = db.query(Document).all()
    
    print(f"Found {len(docs)} documents in database.")
    
    from sqlalchemy import text
    # Xóa toàn bộ FTS5 virtual table contents
    try:
        db.execute(text("DELETE FROM document_pages_fts"))
        db.commit()
    except Exception as e:
        pass
    
    for doc in docs:
        print(f"\nProcessing: {doc.title} ({doc.file_path})")
        if not os.path.exists(doc.file_path):
            # Fallback to sample_docs if original path is missing
            basename = os.path.basename(doc.file_path)
            sample_docs_path = os.path.join(os.path.dirname(__file__), "sample_docs", basename)
            if os.path.exists(sample_docs_path):
                print(f"Original file missing, using sample_docs path: {sample_docs_path}")
                doc.file_path = sample_docs_path
                db.commit()
            else:
                print(f"File not found: {doc.file_path}")
                update_document_status(db, doc, "FAILED", error="File not found")
                continue
            
        # Xóa các page cũ trong SQLite
        db.query(DocumentPage).filter(DocumentPage.document_id == doc.id).delete()
        db.commit()
        
        try:
            update_document_status(db, doc, "PROCESSING")
            ft = doc.file_type.lower()
            if ft == "pdf":
                chunks_with_pages = _ingest_pdf(doc.file_path, doc.title)
            else:
                text = _extract_text(doc.file_path, doc.file_type)
                if not text.strip():
                    raise ValueError("File không có nội dung văn bản để xử lý")
                raw_chunks = chunk_text(text)
                chunks_with_pages = [
                    {"text": c, "page_number": 1}
                    for c in raw_chunks
                ]
            
            if not chunks_with_pages:
                raise ValueError("File không có nội dung văn bản để xử lý")
            
            documents_for_vector = []
            metadatas_for_vector = []
            chroma_ids_input = []
            total_tokens = 0
            
            for i, chunk_info in enumerate(chunks_with_pages):
                chunk_text_content = chunk_info["text"]
                page_number = chunk_info["page_number"]
                tokens = len(chunk_text_content) // 4
                total_tokens += tokens
                v_id = str(uuid.uuid4())
                
                metadata = {
                    "source": doc.title,
                    "document_id": doc.id,
                    "chunk_index": i,
                    "page_number": page_number,
                    "vector_id": v_id,
                }
                documents_for_vector.append(chunk_text_content)
                metadatas_for_vector.append(metadata)
                chroma_ids_input.append(v_id)
                
            if documents_for_vector:
                # Tạo collection mới trên ChromaDB nếu đã bị delete
                vs = get_vector_store()
                
                chroma_ids = add_documents_to_store(
                    texts=documents_for_vector,
                    metadatas=metadatas_for_vector,
                    ids=chroma_ids_input,
                )
                
                for i, (chunk_info, v_id) in enumerate(zip(chunks_with_pages, chroma_ids)):
                    tokens = len(chunk_info["text"]) // 4
                    page_in = DocumentPageCreate(
                        document_id=doc.id,
                        chunk_index=i,
                        raw_content=chunk_info["text"],
                        token_count=tokens,
                        page_metadata=json.dumps(metadatas_for_vector[i]),
                        vector_id=v_id,
                    )
                    db_page = create_document_page(db, page_in)
                    try:
                        sync_page_to_fts(db, db_page.id, chunk_info["text"])
                    except Exception as e:
                        print(f"Lỗi FTS5 sync: {e}")
                        
            update_document_status(db, doc, "SUCCESS", total_tokens=total_tokens)
            print(f"[Ingestion OK] {doc.title} -> {len(chunks_with_pages)} chunks, {total_tokens} tokens")
            
        except Exception as e:
            update_document_status(db, doc, "FAILED", error=str(e))
            print(f"[Ingestion FAIL] {doc.title}: {e}")
            
    print("\nRe-ingestion complete.")

if __name__ == '__main__':
    reingest_all()
