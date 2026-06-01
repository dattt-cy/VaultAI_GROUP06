# VaultAI — Hệ Thống Hỏi-Đáp Tài Liệu Nội Bộ Chạy Offline

> Hệ thống RAG (Retrieval-Augmented Generation) cấp doanh nghiệp, chạy hoàn toàn offline — không có dữ liệu nào rời khỏi máy chủ nội bộ. Tương tự Google NotebookLM nhưng air-gapped và tự triển khai.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Ollama](https://img.shields.io/badge/LLM-Ollama%20%7C%20Qwen-black)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Mục Lục

- [Tổng Quan](#tổng-quan)
- [Tính Năng](#tính-năng)
- [Kiến Trúc Hệ Thống](#kiến-trúc-hệ-thống)
- [Tech Stack](#tech-stack)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Thành Viên Nhóm](#thành-viên-nhóm)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)

---

## Tổng Quan

VaultAI giải quyết bài toán: **LLM không biết tài liệu nội bộ của tổ chức**. Thay vì hỏi AI "đoán mò", hệ thống tự động tìm đúng đoạn văn liên quan trong kho tài liệu rồi để LLM đọc và trả lời có trích dẫn nguồn cụ thể.

```
Người dùng hỏi
    → Hybrid Search (Vector + BM25) tìm đoạn văn liên quan
    → Re-ranking lọc kết quả chính xác nhất
    → LLM (Qwen3:8b) đọc context + sinh câu trả lời
    → Trả về kèm trích dẫn nguồn tài liệu
```

Toàn bộ pipeline chạy trên máy chủ nội bộ, **không gọi bất kỳ API bên ngoài nào**.

---

## Tính Năng

### Xử Lý Tài Liệu
- Upload PDF, Word (.docx), ảnh scan (OCR), TXT, Markdown
- Nhận diện chữ viết trong ảnh qua EasyOCR
- Parent-Child Chunking: chunk nhỏ (300 tokens) để tìm kiếm, chunk lớn (800 tokens) để đưa vào LLM
- Phát hiện và loại bỏ tài liệu trùng lặp tự động
- Trích xuất metadata tự động (tiêu đề, ngày, loại tài liệu)

### RAG Pipeline
- **Hybrid Search**: kết hợp Vector Search (ChromaDB) + BM25 full-text
- **Re-ranking**: Cross-Encoder `mmarco-mMiniLMv2-L12-H384-v1` lọc kết quả chính xác
- **Query Rewriting**: tự động viết lại câu hỏi mơ hồ trước khi tìm kiếm
- **Multi-intent Detection**: nhận diện 6 loại ý định (hỏi-đáp, so sánh, tóm tắt, liệt kê, trích xuất bảng, định vị đoạn văn)
- **Anti-Hallucination**: kiểm tra câu trả lời có nguồn gốc từ tài liệu
- **PII Masking**: tự động che thông tin nhạy cảm (CMND, SĐT) trong output
- Trích dẫn nguồn kèm số trang cho mỗi câu trả lời

### Giao Diện & UX
- Streaming response (hiển thị từng ký tự như ChatGPT)
- PDF viewer tích hợp với highlight đoạn văn trích dẫn
- Dark mode, tùy chỉnh cỡ chữ
- Voice-to-text (thu âm câu hỏi)
- Gợi ý câu hỏi AI dựa trên nội dung tài liệu
- Xuất báo cáo Excel / PDF
- Kéo thả upload trực tiếp vào workspace

### Bảo Mật & Phân Quyền
- JWT Authentication (access token 8 ngày)
- Hệ thống phân quyền 10 cấp (access level 1–10)
- RBAC theo tài liệu: cấp/thu quyền xem theo user hoặc role
- Audit Log toàn bộ hoạt động
- Active session management — xem & thu hồi phiên đăng nhập
- Tự động khóa tài khoản sau nhiều lần đăng nhập sai
- Chế độ Air-Gapped: hoàn toàn offline, không cần internet

### Admin Panel
- Dashboard thống kê hệ thống
- Quản lý user, role, phòng ban
- Cấu hình RAG động (chunk size, overlap, top-k, reranker...)
- Quản lý Ollama model (pull, delete, switch)
- Giám sát chat realtime toàn bộ người dùng
- Bộ eval RAG: chạy test accuracy & latency từ giao diện
- Backup & restore database + vector store
- Lịch sao lưu tự động định kỳ

---

## Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────┐
│                    LocalAIFrontend                      │
│           React 19 + TypeScript + Vite                  │
│   WorkspacePage │ AdminPanel │ ChatPanel │ PDFViewer    │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────┐
│                    LocalAIBackend                       │
│                FastAPI + SQLAlchemy                     │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Auth / RBAC │  │  RAG Engine  │  │  Admin APIs   │  │
│  └─────────────┘  └──────┬───────┘  └───────────────┘  │
│                          │                              │
│  ┌───────────────────────▼──────────────────────────┐  │
│  │               RAG Pipeline                       │  │
│  │  Query Rewrite → Hybrid Search → Re-rank → LLM  │  │
│  └──────┬────────────────────────────────┬──────────┘  │
│         │                                │              │
│  ┌──────▼──────┐                  ┌──────▼──────┐      │
│  │  ChromaDB   │                  │   Ollama    │      │
│  │ (Vectors)   │                  │ Qwen3:8b   │      │
│  └─────────────┘                  └─────────────┘      │
│         │                                               │
│  ┌──────▼──────┐                                        │
│  │   SQLite    │                                        │
│  │ (Metadata)  │                                        │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Công nghệ |
|:---:|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Material UI v9, Zustand |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy, Uvicorn |
| **LLM** | Ollama — `qwen2.5:7b` / `qwen3:8b` (chạy local) |
| **Embedding** | `paraphrase-multilingual-MiniLM-L12-v2` (hỗ trợ tiếng Việt) |
| **Re-ranker** | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` |
| **Vector DB** | ChromaDB |
| **Relational DB** | SQLite + FTS5 |
| **Auth** | JWT (python-jose) + Bcrypt (passlib) |
| **OCR** | EasyOCR |
| **Document Parse** | pdfplumber, PyMuPDF, mammoth |
| **Container** | Docker + Docker Compose |

---

## Cài Đặt & Chạy

### Yêu cầu
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.ai) đã cài và pull model:
  ```bash
  ollama pull qwen2.5:7b
  ```

### Cách 1 — Docker (khuyến nghị)

```bash
docker-compose up --build
```

Truy cập: `http://localhost:5173`

### Cách 2 — Chạy thủ công

**Backend:**
```bash
cd LocalAIBackend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py               # http://localhost:8000
```

**Frontend:**
```bash
cd LocalAIFrontend
npm install
npm run dev                  # http://localhost:5173
```

### Kiểm tra

```
API docs:  http://localhost:8000/docs
Dashboard: http://localhost:8000/api/v1/admin/overview
```

---

## Thành Viên Nhóm

> Dự án môn học — Học kỳ 1, 2025–2026

| | Thành viên | Vai trò | Phụ trách chính |
|:---:|---|---|---|
| | **Hoàng Văn Tấn Đạt** | AI Engineer | LLM Engine, RAG Pipeline, Context Manager, Query Rewriting, Multi-intent Detection, PII Masking, Eval System, Docker |
| | **Cao Minh Đức** | Backend Developer | Document Parser (PDF/Word/OCR), Ingestion Service, FastAPI app, Database schema, JWT Auth, Phân quyền, Streaming SSE |
| | **Nguyễn Lê Dung** | Full-stack Developer | Hybrid Retriever (Vector + BM25), Re-ranking, Toàn bộ React Frontend, Admin Panel, Bảo mật RBAC, Backup & Bàn giao |

---

## Cấu Trúc Thư Mục

```
VaultAI_GROUP06/
├── LocalAIBackend/
│   ├── app/
│   │   ├── api/routes/        # Auth, documents, chat, admin APIs
│   │   ├── core/              # Config, JWT security
│   │   ├── crud/              # Database operations
│   │   ├── db/                # SQLAlchemy session
│   │   ├── models/            # ORM models
│   │   ├── schemas/           # Pydantic DTOs
│   │   └── services/
│   │       ├── rag_pipeline.py       # RAG core + multi-intent
│   │       ├── llm_engine.py         # Ollama interface
│   │       ├── hybrid_retriever.py   # Vector + BM25 search
│   │       ├── context_manager.py    # Query rewriting
│   │       ├── document_parser.py    # PDF/Word/OCR parser
│   │       └── ingestion_service.py  # Chunk + embed + index
│   ├── eval/                  # RAG evaluation suite
│   ├── main.py
│   └── requirements.txt
│
├── LocalAIFrontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat-panel/    # ChatPanel, MessageBubble, Citations
│   │   │   ├── document-panel/# PDF viewer + highlights
│   │   │   ├── left-panel/    # Sidebar, suggestions, upload
│   │   │   └── admin/         # Admin components
│   │   ├── pages/             # Login, Dashboard, Workspace, Admin
│   │   ├── store/             # Zustand state management
│   │   ├── services/          # API call layer
│   │   └── hooks/             # Custom React hooks
│   └── package.json
│
└── docker-compose.yml
```
