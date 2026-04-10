import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Suppress noisy warnings in terminal chat mode
import warnings
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load all models so foreign keys resolve
from app.models import user_model, doc_model, chat_model, sys_model  # noqa
from app.db.session import SessionLocal
from app.services.hybrid_retriever import hybrid_retrieve
from app.services.llm_engine import get_llm, apply_pii_masking, check_hallucination

BANNER = """
╔══════════════════════════════════════════════════════════╗
║        LOCAL AI – Terminal Chat  (Hybrid RAG)            ║
║  Model : llama3:8b  │  VectorDB: Chroma  │  DB: SQLite  ║
║  Gõ  'quit' hoặc 'thoát' để kết thúc                    ║
╚══════════════════════════════════════════════════════════╝
"""

QA_PROMPT = """\
Bạn là một trợ lý AI thông minh, chuyên hỗ trợ phân tích tài liệu nội bộ.

HƯỚNG DẪN:
1. Chỉ dùng thông tin trong phần NGỮ CẢNH để trả lời.
2. Không tự bịa đặt thông tin (No hallucination).
3. Nếu không có câu trả lời, hãy nói: "Tôi không tìm thấy thông tin này trong tài liệu nội bộ."
4. Trả lời bằng tiếng Việt.

--- NGỮ CẢNH ---
{context}
----------------

Câu hỏi: {question}
Câu trả lời:"""


def run_chat():
    print(BANNER)
    print("⏳ Đang khởi tạo kết nối LLM... ", end="", flush=True)
    llm = get_llm()
    print("✅ Sẵn sàng!\n")

    db = SessionLocal()

    try:
        while True:
            try:
                user_input = input("🧑 Bạn: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n👋 Tạm biệt!")
                break

            if not user_input:
                continue
            if user_input.lower() in ("quit", "exit", "thoát", "q"):
                print("👋 Tạm biệt!")
                break

            print("\n🔍 Đang tìm kiếm tài liệu liên quan (Hybrid RAG)...", flush=True)

            # 1. Hybrid Retrieval
            chunks = hybrid_retrieve(db=db, query=user_input, top_k=4, neighbor_window=1)

            if not chunks:
                print("🤖 AI: Tôi không tìm thấy tài liệu liên quan trong hệ thống.\n")
                continue

            # 2. Ghép ngữ cảnh
            context = "\n\n".join(c.content for c in chunks)

            # Kiểm tra ngữ cảnh có rỗng không
            if check_hallucination(context, user_input):
                print("🤖 AI: Tôi không tìm thấy thông tin này trong tài liệu nội bộ.\n")
                continue

            # 3. Hiển thị nguồn tìm được
            print(f"📄 Tìm được {len(chunks)} đoạn từ {len(set(c.document_id for c in chunks))} tài liệu")
            for c in chunks:
                tag = "🔵" if c.source_type == "hybrid" else "⬜"
                print(f"   {tag} Doc#{c.document_id} Chunk#{c.chunk_index} | RRF={c.rrf_score:.4f} | "
                      f"{c.content[:60].strip()}...")

            # 4. Gọi LLM
            print("\n🤖 AI đang trả lời...\n")
            prompt = QA_PROMPT.format(context=context, question=user_input)

            response = ""
            # Stream từng token ra terminal
            for token in llm.stream(prompt):
                print(token, end="", flush=True)
                response += token

            print("\n")  # Xuống dòng sau câu trả lời

            # 5. Lọc PII
            apply_pii_masking(response)

    finally:
        db.close()


if __name__ == "__main__":
    run_chat()
