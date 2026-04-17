import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.doc_model import DocumentPage
from app.services.hybrid_retriever import hybrid_retrieve

def test_retrieve():
    db = SessionLocal()
    chunks = hybrid_retrieve(db=db, query="có bao nhiêu kịch bản kiểm thử", top_k=5)
    print(f"Retrieved {len(chunks)} chunks with top_k=5.")
    for c in chunks:
        print(f"Doc {c.document_id} - Chunk {c.chunk_index} - {c.source_type}")
    
    print("---")
    
    chunks = hybrid_retrieve(db=db, query="có bao nhiêu kịch bản kiểm thử", top_k=10)
    print(f"Retrieved {len(chunks)} chunks with top_k=10.")
    for c in chunks:
        print(f"Doc {c.document_id} - Chunk {c.chunk_index} - {c.source_type}")

if __name__ == "__main__":
    test_retrieve()
