# 🧠 LocalAI Backend

Backend của hệ thống **LocalAI** — một trợ lý AI nội bộ dựa trên RAG (Retrieval-Augmented Generation) chạy hoàn toàn offline, tích hợp Ollama + ChromaDB + MySQL.

---

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [Cấu hình](#cấu-hình)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [API Endpoints](#api-endpoints)
- [Chạy tests](#chạy-tests)

---

## 🔍 Tổng quan

Backend cung cấp REST API cho hệ thống hỏi-đáp tài liệu nội bộ sử dụng kiến trúc RAG. Hệ thống cho phép:

- Upload và xử lý tài liệu (PDF, Word, ảnh, txt...)
- Tìm kiếm ngữ nghĩa qua vector database (ChromaDB)
- Hỏi-đáp thông minh với LLM chạy local qua Ollama
- Quản lý người dùng, phân quyền, backup dữ liệu

---

## 🛠️ Công nghệ sử dụng

### Framework & Core

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **Python** | ≥ 3.10 | Ngôn ngữ chính |
| **FastAPI** | Latest | REST API framework |
| **Uvicorn** | Latest | ASGI server |
| **Pydantic / pydantic-settings** | Latest | Data validation & cấu hình |

### Database

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **MySQL** | ≥ 8.0 | Cơ sở dữ liệu chính (users, docs, chat history) |
| **SQLAlchemy** | Latest | ORM |
| **PyMySQL** | Latest | MySQL driver |
| **ChromaDB** | Latest | Vector database (lưu embeddings) |

### AI / Machine Learning

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **Ollama** | Latest | Chạy LLM local (qwen2.5:7b, qwen3:8b...) |
| **LangChain** | Latest | Framework RAG pipeline |
| **langchain-chroma** | Latest | Tích hợp ChromaDB |
| **langchain-ollama** | Latest | Tích hợp Ollama |
| **langchain-community** | Latest | Các loader, tool bổ sung |
| **sentence-transformers** | Latest | Embedding model (paraphrase-multilingual-MiniLM-L12-v2) |

### Xử lý tài liệu

| Công nghệ | Mục đích |
|---|---|
| **pdfplumber** | Đọc và trích xuất text từ PDF |
| **PyMuPDF (fitz)** | Xử lý PDF nâng cao |
| **mammoth** | Chuyển đổi file Word (.docx) |
| **EasyOCR** | OCR nhận dạng chữ trong ảnh |
| **Pillow** | Xử lý hình ảnh |

### Bảo mật

| Công nghệ | Mục đích |
|---|---|
| **python-jose[cryptography]** | Tạo và xác thực JWT token |
| **passlib[bcrypt]** | Hash mật khẩu |

### Testing

| Công nghệ | Mục đích |
|---|---|
| **pytest ≥ 7.4** | Test framework |
| **pytest-asyncio ≥ 0.21** | Async test support |
| **httpx ≥ 0.25** | HTTP client cho test |
| **pytest-mock ≥ 3.12** | Mocking |

---

## 💻 Yêu cầu hệ thống

- **OS**: Windows 10/11, Ubuntu 20.04+, macOS 12+
- **Python**: 3.10 hoặc mới hơn
- **RAM**: Tối thiểu 8GB (khuyến nghị 16GB nếu chạy LLM lớn)
- **GPU** *(tùy chọn)*: NVIDIA với VRAM ≥ 4GB để tăng tốc inference
- **Disk**: ≥ 10GB trống (chứa model LLM và vector DB)
- **MySQL**: 8.0+
- **Ollama**: Cài đặt riêng ([hướng dẫn dưới](#3-cài-đặt-ollama-và-model-llm))

---

## 🚀 Cài đặt và chạy

### 1. Clone và di chuyển vào thư mục backend

```bash
git clone <url-repo>
cd LocalAIBackend
```

### 2. Tạo và kích hoạt môi trường ảo Python

```bash
# Tạo venv
python -m venv venv

# Kích hoạt trên Windows
venv\Scripts\activate

# Kích hoạt trên Linux/macOS
source venv/bin/activate
```

### 3. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

> ⚠️ **Lưu ý**: EasyOCR và sentence-transformers sẽ tự động tải model về lần đầu chạy (~500MB). Đảm bảo kết nối internet lần đầu.

### 4. Cài đặt MySQL và tạo database

```sql
-- Chạy trong MySQL client
CREATE DATABASE localai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'localai_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON localai.* TO 'localai_user'@'localhost';
FLUSH PRIVILEGES;
```

> Mặc định config dùng: `root:1234567890aS@localhost:3306/localai`. Xem phần [Cấu hình](#cấu-hình) để thay đổi.

### 5. Cài đặt Ollama và tải model LLM

**Cài Ollama** tại: https://ollama.com/download

```bash
# Sau khi cài xong, tải model mặc định
ollama pull qwen2.5:7b

# (Tùy chọn) Model hỗ trợ thinking/reasoning
ollama pull qwen3:8b

# Kiểm tra Ollama đang chạy
ollama list
```

> Ollama mặc định chạy tại `http://localhost:11434`

### 6. Chạy Backend

```bash
# Chạy với hot-reload (development)
python main.py

# Hoặc dùng uvicorn trực tiếp
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend sẽ khởi động tại: **http://localhost:8000**

- API Docs (Swagger): http://localhost:8000/api/v1/openapi.json
- Health check: http://localhost:8000/api/health

### 7. Tài khoản mặc định

Khi khởi động lần đầu, hệ thống tự tạo tài khoản admin:

```
Username: admin
Password: admin123
```

> ⚠️ **Đổi mật khẩu ngay sau khi đăng nhập lần đầu!**

---

## ⚙️ Cấu hình

Cấu hình nằm trong file `app/core/config.py`. Bạn có thể ghi đè bằng biến môi trường hoặc file `.env`.

### Các biến quan trọng

```python
# Database MySQL
SQLALCHEMY_DATABASE_URI = "mysql+pymysql://root:password@localhost:3306/localai?charset=utf8mb4"

# ChromaDB (vector store)
CHROMA_PERSIST_DIR = "./chroma_db"

# JWT Security
SECRET_KEY = "your-very-secret-key-here"  # Thay bằng key ngẫu nhiên mạnh!
ACCESS_TOKEN_EXPIRE_MINUTES = 11520  # 8 ngày

# LLM (Ollama)
OLLAMA_BASE_URL = "http://localhost:11434"
LLM_MODEL_NAME = "qwen2.5:7b"
LLM_TEMPERATURE = 0.1
LLM_NUM_CTX = 8192       # Context window (phụ thuộc VRAM)
LLM_NUM_PREDICT = 4096   # Max tokens output

# Embedding Model
EMBEDDING_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

# Reranker
RERANKER_MODEL_NAME = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

# Chunking Strategy (Parent-Child RAG)
PARENT_CHUNK_SIZE = 800
CHILD_CHUNK_SIZE = 300
```

### Tạo file `.env` (khuyến nghị)

```env
SQLALCHEMY_DATABASE_URI=mysql+pymysql://root:yourpassword@localhost:3306/localai?charset=utf8mb4
SECRET_KEY=your-random-secret-key-minimum-32-chars
LLM_MODEL_NAME=qwen2.5:7b
```

---

## 📁 Cấu trúc thư mục

```
LocalAIBackend/
├── main.py                  # Entrypoint chính
├── requirements.txt         # Python dependencies
├── localai.db               # SQLite (nếu dùng SQLite thay MySQL)
├── chroma_db/               # ChromaDB vector store (tự tạo)
├── uploads/                 # File tài liệu upload
│   └── avatars/             # Avatar người dùng
├── app/
│   ├── main.py              # FastAPI app, middleware, router đăng ký
│   ├── core/
│   │   ├── config.py        # Cấu hình toàn cục (Settings)
│   │   └── security.py      # JWT, password hashing
│   ├── db/
│   │   ├── base.py          # SQLAlchemy Base
│   │   └── session.py       # Engine, SessionLocal
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── user_model.py    # User, Role
│   │   ├── doc_model.py     # Document, Chunk
│   │   ├── chat_model.py    # Conversation, Message, Feedback
│   │   └── sys_model.py     # LlmConfig, SystemPrompt, RagConfig
│   ├── schemas/             # Pydantic schemas (request/response)
│   ├── crud/                # CRUD operations
│   ├── api/
│   │   ├── dependencies.py  # Auth dependencies, permission levels
│   │   └── routes/
│   │       ├── auth.py           # Đăng nhập, đăng xuất
│   │       ├── documents.py      # Upload, quản lý tài liệu
│   │       ├── chat.py           # Chat, hỏi-đáp RAG
│   │       ├── admin.py          # Quản trị hệ thống
│   │       ├── admin_ollama.py   # Quản lý Ollama models
│   │       ├── admin_rag_config.py # Cấu hình RAG
│   │       ├── admin_backup.py   # Backup/restore
│   │       ├── admin_security.py # Bảo mật, phân quyền
│   │       └── admin_legal_import.py # Import văn bản pháp luật
│   └── services/
│       ├── rag_pipeline.py       # Pipeline RAG chính
│       ├── hybrid_retriever.py   # Tìm kiếm hybrid (vector + BM25)
│       ├── ingestion_service.py  # Xử lý và index tài liệu
│       ├── document_parser.py    # Parse PDF, Word, ảnh...
│       ├── llm_engine.py         # Giao tiếp với Ollama
│       ├── vector_store.py       # ChromaDB wrapper
│       ├── context_manager.py    # Quản lý context hội thoại
│       ├── config_loader.py      # Load cấu hình động
│       └── legal_importer.py     # Import văn bản pháp luật
└── tests/                   # Unit & integration tests
```

---

## 🌐 API Endpoints

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Đăng nhập, lấy JWT token | ❌ |
| GET | `/api/auth/me` | Thông tin user hiện tại | ✅ |
| POST | `/api/documents/upload` | Upload tài liệu | ✅ |
| GET | `/api/documents` | Danh sách tài liệu | ✅ |
| DELETE | `/api/documents/{id}` | Xóa tài liệu | ✅ |
| POST | `/api/chat/` | Gửi câu hỏi, nhận trả lời RAG | ✅ |
| GET | `/api/chat/conversations` | Lịch sử hội thoại | ✅ |
| GET | `/api/admin/users` | Quản lý người dùng | 🔑 Admin |
| GET | `/api/admin/ollama/models` | Danh sách model Ollama | 🔑 Admin |
| GET | `/api/health` | Health check | ❌ |

> Xem đầy đủ tại Swagger UI: `http://localhost:8000/docs` (nếu bật)

---

## 🧪 Chạy Tests

```bash
# Kích hoạt venv trước
venv\Scripts\activate  # Windows

# Chạy toàn bộ test
pytest

# Chạy với verbose output
pytest -v

# Chạy 1 file test cụ thể
pytest tests/test_auth.py -v
```

---

## 🤝 Lưu ý khi phát triển

1. **CORS**: Mặc định cho phép `localhost:5173` và `localhost:5174` (port Vite dev server).
2. **JWT Secret**: Không dùng key mặc định trong production. Tạo key ngẫu nhiên mạnh.
3. **GPU**: Nếu không có GPU NVIDIA, Ollama sẽ chạy trên CPU (chậm hơn ~5-10x).
4. **ChromaDB**: Dữ liệu vector lưu tại `./chroma_db/` — không xóa thư mục này nếu không muốn mất index.
5. **First Run**: Lần đầu chạy, sentence-transformers và EasyOCR sẽ tải model (~500MB-1GB).
