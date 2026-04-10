import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.doc_model import DocumentPage         # noqa – cần load metadata
from app.models.chat_model import ChatSession, Message  # noqa – load ForeignKey
from app.models.user_model import User, Role           # noqa – load ForeignKey
from app.services.hybrid_retriever import hybrid_retrieve

DIVIDER = "=" * 60

def print_section(title: str):
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)

def run_hybrid_test():
    db = SessionLocal()
    try:
        print_section("HYBRID RAG RETRIEVAL – Kiểm tra tích hợp")

        queries = [
            # Loại 1: Câu hỏi ngữ nghĩa (Semantic) → ChromaDB giỏi hơn
            "Tính năng nhúng vector_id ngược lại giúp ích gì?",
            # Loại 2: Câu hỏi từ khóa chính xác (Keyword) → FTS5 giỏi hơn
            "ChromaDB"
        ]

        for query in queries:
            print(f"\n{'─'*60}")
            print(f"📝 Câu hỏi: '{query}'")
            print(f"{'─'*60}")

            chunks = hybrid_retrieve(db=db, query=query, top_k=3, neighbor_window=1)

            if not chunks:
                print("  ⚠️  Không tìm thấy kết quả nào!")
                continue

            for i, chunk in enumerate(chunks):
                label = "🔵 [HYBRID-CORE]" if chunk.source_type == "hybrid" else "⬜ [NEIGHBOR-EXPAND]"
                print(f"\n  {label} Kết quả #{i+1}")
                print(f"    Document ID   : {chunk.document_id}")
                print(f"    Chunk Index   : {chunk.chunk_index}")
                print(f"    RRF Score     : {chunk.rrf_score:.4f}")
                print(f"    Token Count   : {chunk.token_count}")
                print(f"    Nội dung trích: {chunk.content[:80].strip()}...")

        print_section("KẾT THÚC")

    except Exception as e:
        print(f"\n❌ Lỗi: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_hybrid_test()
