# 📋 Phân Công Công Việc Nhóm — Dự Án LocalAI

> **Dự án**: LocalAI — Hệ thống hỏi-đáp tài liệu nội bộ thông minh (RAG + LLM chạy offline)
> **Nhóm**: 3 thành viên
> **Thời gian**: Học kỳ 1, 2025–2026
> **Nguồn phân công**: Jira Board (QN-1 → QN-63)

---

## 👥 Danh Sách Thành Viên

| STT | Họ và Tên | Tài khoản Jira | Vai trò chính |
|:---:|---|---|---|
| 1 | **Hoàng Văn Tấn Đạt** | hoangdat10102005 | AI Engineer — Hạ tầng Local & Suy luận AI |
| 2 | **Cao Minh Đức** | Minh Đức Cao | Backend Developer — Xử lý dữ liệu & API |
| 3 | **Nguyễn Lê Dung** | Lê Dung Nguyễn | Full-stack — RAG Indexing, Bảo mật & Bàn giao |

---

## 🤖 Hoàng Văn Tấn Đạt — AI Engineer

> **Phụ trách**: Hạ tầng chạy Local, tối ưu tài nguyên, lõi suy luận AI, đánh giá chất lượng

### [QN-1] Hạ tầng & Tối ưu Local ✅

| Task | Mô tả |
|---|---|
| QN-2 | Cài đặt Docker 1-click |
| QN-3 | Tự động phát hiện Phần cứng |
| QN-4 | Quản lý Giới hạn Ngữ cảnh (Context Window) |
| QN-5 | Quản lý nén mô hình |
| QN-6 | Tối ưu hóa bộ nhớ đệm |

**Chi tiết kỹ thuật:**
- Xây dựng **LLM Engine** (`llm_engine.py`) — giao tiếp Ollama API, model `qwen2.5:7b` / `qwen3:8b`
- Tối ưu tham số inference cho GPU 4GB VRAM (RTX 3050):
  - `num_ctx = 8192`, `temperature = 0.1`, `num_predict = 4096`
- Xây dựng **Context Manager** (`context_manager.py`) — giới hạn context window phù hợp VRAM
- Tích hợp chế độ **Thinking/Reasoning** với `qwen3:8b`
- Cấu hình **Docker Compose** khởi động toàn bộ stack 1 lệnh

### [QN-22] Lõi Suy luận & Logic AI ✅ *(một phần)*

| Task | Mô tả |
|---|---|
| QN-23 | Suy luận dựa trên Tài liệu |
| QN-25 | Trích dẫn nguồn (Citations) |
| QN-26 | Tổng hợp đa tài liệu |
| QN-28 | So sánh & Tìm mâu thuẫn tài liệu |

**Chi tiết kỹ thuật:**
- Thiết kế **RAG Pipeline** (`rag_pipeline.py`) — nhận câu hỏi → tìm kiếm → sinh câu trả lời có trích dẫn
- Xây dựng **Config Loader** (`config_loader.py`) — tải cấu hình RAG động từ database
- Tích hợp **Citations** vào response — mỗi câu trả lời kèm nguồn tài liệu cụ thể
- Tổng hợp thông tin từ nhiều tài liệu khác nhau trong một câu trả lời

### [QN-30] Giao diện Chat & Tương tác ✅ *(một phần)*

| Task | Mô tả |
|---|---|
| QN-33 | Viewer PDF tích hợp |
| QN-38 | Giao diện thu âm |

### [QN-53] Giám sát & Đảm bảo Chất lượng 🔄 *(một phần)*

| Task | Mô tả | Trạng thái |
|---|---|---|
| QN-54 | Kiểm thử Accuracy (Độ chính xác) | ✅ Done |
| QN-55 | Đo lường Latency (Độ trễ) | ✅ Done |
| QN-56 | Đánh giá Thích/Không thích | ✅ Done |

**Chi tiết kỹ thuật:**
- Bộ eval RAG pipeline — câu hỏi mẫu, script đánh giá, kết quả benchmark
- Đo latency end-to-end từ lúc nhận câu hỏi đến khi stream xong
- Tích hợp feedback thumbs up/down vào pipeline cải thiện

### Tính năng AI nâng cao *(ngoài Jira)*

- **Multi-intent detection** — Tự động nhận diện 6 loại ý định: hỏi-đáp, so sánh, tóm tắt, liệt kê, trích xuất bảng, định vị đoạn văn
- **Query rewriting** — Viết lại câu hỏi mơ hồ / thiếu ngữ cảnh trước khi tìm kiếm
- **PII masking** — Tự động che thông tin nhạy cảm (số CMND, SĐT...) trong câu trả lời
- **Gợi ý câu hỏi** (`GET /suggestions`) — AI sinh câu hỏi gợi ý dựa trên nội dung tài liệu

### Trang Eval *(ngoài Jira)*

- **EvalPage** (`admin/EvalPage.tsx`) — Xem kết quả đánh giá chất lượng RAG, chạy bộ test trực tiếp từ giao diện

### 📁 Files phụ trách
```
LocalAIBackend/app/services/
├── rag_pipeline.py        ✅ Pipeline RAG chính + multi-intent
├── llm_engine.py          ✅ Giao tiếp Ollama LLM
├── context_manager.py     ✅ Quản lý context + query rewriting
├── config_loader.py       ✅ Load cấu hình RAG động
├── rag_prompts.py         ✅ System prompts & templates
└── rag_postprocess.py     ✅ PII masking, chuẩn hóa output

LocalAIBackend/app/api/routes/
└── admin_eval.py          ✅ API chạy & xem kết quả eval RAG

LocalAIBackend/eval/       ✅ Bộ đánh giá RAG
docker-compose.yml         ✅ Docker stack
```

---

## 🖥️ Cao Minh Đức — Backend Developer

> **Phụ trách**: Nạp & tiền xử lý tài liệu, API server, database, xử lý logic AI phụ trợ

### [QN-7] Nạp & Tiền xử lý Dữ liệu ✅

| Task | Mô tả |
|---|---|
| QN-8 | Tải lên Thư mục (Bulk) |
| QN-9 | Xử lý file Docx/Excel |
| QN-10 | Nhận diện chữ viết OCR |
| QN-11 | Làm sạch nội dung (Clean) |
| QN-12 | Trích xuất Metadata tự động |
| QN-13 | Phát hiện tài liệu trùng |
| QN-14 | Xóa vĩnh viễn & Dọn chỉ mục (Purge) |

**Chi tiết kỹ thuật:**
- Xây dựng **Document Parser** (`document_parser.py`) — hỗ trợ PDF, Word (.docx), ảnh OCR, TXT, Markdown
  - Tích hợp **EasyOCR** nhận dạng văn bản trong hình ảnh / scan
  - Tích hợp **pdfplumber + PyMuPDF** extract text từ PDF
  - Tích hợp **mammoth** đọc file Word
- Xây dựng **Ingestion Service** (`ingestion_service.py`) — parse → chunk → embed → lưu ChromaDB
- Xây dựng **RAG Postprocess** (`rag_postprocess.py`) — làm sạch và chuẩn hóa output
- Phát hiện tài liệu trùng lặp trước khi index

### [QN-22] Lõi Suy luận & Logic AI ✅ *(một phần)*

| Task | Mô tả |
|---|---|
| QN-24 | Chặn ảo giác (Anti-Hallucination) |
| QN-27 | Luồng suy nghĩ (Chain-of-Thought) |

**Chi tiết kỹ thuật:**
- Xây dựng cơ chế **Anti-Hallucination** — kiểm tra câu trả lời có nguồn gốc từ tài liệu
- Tích hợp **Chain-of-Thought** vào prompt để cải thiện độ chính xác suy luận

### [QN-30] Giao diện Chat & Tương tác ✅ *(một phần)*

| Task | Mô tả |
|---|---|
| QN-31 | Phản hồi Streaming (Gõ chữ từng ký tự) |
| QN-32 | Tóm tắt tài liệu AI |
| QN-34 | Highlight văn bản trích dẫn |
| QN-35 | Chế độ Nền tối (Dark mode) |
| QN-36 | Tùy chỉnh Cỡ chữ UI |
| QN-37 | Thông báo lỗi tiếng Việt |

**Chi tiết kỹ thuật:**
- Xây dựng **FastAPI** application (`app/main.py`) — đăng ký router, CORS, static files
- Thiết kế toàn bộ **database schema** với SQLAlchemy (`users`, `documents`, `conversations`, `llm_configs`...)
- Xây dựng **JWT Authentication** — đăng nhập → access token (8 ngày)
- Xây dựng **hệ thống phân quyền** — access level 1–10, middleware `require_min_level(n)`
- Streaming response qua Server-Sent Events

### [QN-53] Giám sát & Đảm bảo Chất lượng 🔄 *(một phần)*

| Task | Mô tả | Trạng thái |
|---|---|---|
| QN-57 | Hệ thống báo cáo lỗi trực tiếp | ✅ Done |
| QN-58 | Xác nhận của con người (Human-in-the-loop) | 🔄 In Progress |

### Tính năng bổ sung *(ngoài Jira)*

- **Active session management** — Xem & thu hồi phiên đăng nhập đang hoạt động (`POST /security/sessions/{id}/revoke`)
- **Failed login tracking** — Theo dõi số lần đăng nhập sai, tự động khóa tài khoản
- **Force password reset** — Admin ép người dùng đổi mật khẩu (`POST /security/password-reset/{user_id}`)
- **Truncate messages** — Xóa tin nhắn từ một điểm nhất định để edit & resend

### 📁 Files phụ trách
```
LocalAIBackend/
├── main.py                         ✅ Entrypoint server
├── requirements.txt                ✅ Python dependencies
└── app/
    ├── main.py                     ✅ FastAPI app, middleware, router
    ├── core/
    │   ├── config.py               ✅ Cấu hình toàn cục
    │   └── security.py             ✅ JWT, password hash
    ├── db/
    │   ├── base.py                 ✅ SQLAlchemy Base
    │   └── session.py              ✅ DB engine, session
    ├── models/                     ✅ User, Doc, Chat, Sys models
    ├── crud/                       ✅ Database CRUD operations
    ├── schemas/                    ✅ Pydantic request/response schemas
    └── api/routes/
        ├── auth.py                 ✅ Xác thực JWT
        ├── documents.py            ✅ Quản lý tài liệu
        ├── chat.py                 ✅ Chat & RAG endpoint + truncate messages
        ├── admin_system.py         ✅ Dashboard stats, overview
        ├── admin_users.py          ✅ CRUD users, roles, departments
        ├── admin_ollama.py         ✅ Quản lý Ollama model
        ├── admin_rag_config.py     ✅ Cấu hình RAG + re-ingestion
        ├── admin_backup.py         ✅ Backup & restore
        └── admin_security.py       ✅ Security settings, session revoke, failed login

    services/
    ├── document_parser.py          ✅ Parse PDF, Word, OCR ảnh
    ├── ingestion_service.py        ✅ Index tài liệu vào vector DB
    └── vector_store.py             ✅ ChromaDB wrapper
```

---

## 🎨 Nguyễn Lê Dung — Full-stack Developer

> **Phụ trách**: RAG Indexing & tìm kiếm, quản lý hội thoại, bảo mật, đóng gói & bàn giao

### [QN-16] Chỉ mục & Tìm kiếm (RAG) ✅

| Task | Mô tả |
|---|---|
| QN-17 | Phân đoạn ngữ nghĩa (Chunk) |
| QN-18 | Cấu hình Overlap (Chồng lấp) |
| QN-19 | Tích hợp VectorDB & Page Index |
| QN-20 | Tìm kiếm lai Hybrid (Vector + Page-level) |
| QN-21 | Re-ranking (Tái xếp hạng) |

**Chi tiết kỹ thuật:**
- Xây dựng **Hybrid Retriever** (`hybrid_retriever.py`) — kết hợp Vector Search (ChromaDB) + BM25
- Triển khai **Parent-Child Chunking** — Child chunk (300 tokens) tìm kiếm, Parent (800 tokens) đưa vào LLM
- Cấu hình **Embedding Model**: `paraphrase-multilingual-MiniLM-L12-v2` — hỗ trợ tốt tiếng Việt
- Cấu hình **Reranker**: `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`
- Tích hợp **ChromaDB** (`vector_store.py`) — lưu trữ và truy vấn vector embeddings

### [QN-39] Quản lý Hội thoại & Workspace ✅

| Task | Mô tả |
|---|---|
| QN-40 | Quản lý Sessions (Phiên) |
| QN-41 | Thư viện Prompt mẫu |
| QN-42 | Chọn Vai trò AI (Persona) |
| QN-43 | Xuất báo cáo (PDF/Docx) |
| QN-44 | Xuất báo cáo dạng bảng |

**Chi tiết kỹ thuật:**
- Khởi tạo project **Vite + React 19 + TypeScript** — hot module replacement cực nhanh
- Cấu hình **TailwindCSS + MUI v9** — design system + component library
- Xây dựng **ChatPanel**, **MessageBubble**, **ChatInput**, **CitationPopup**
- Xây dựng **DashboardPage**, **WorkspacePage**, **Left Panel** sidebar hội thoại
- **DataTable + ExportButtons** — xuất Excel/PDF
- **Zustand stores** — auth state, chat state, UI state

### [QN-45] Bảo mật & Quyền riêng tư ✅

| Task | Mô tả |
|---|---|
| QN-46 | Chế độ Air-Gapped (Offline) |
| QN-47 | Xác thực đăng nhập (Login) |
| QN-48 | Phân quyền tài liệu (RBAC) |
| QN-49 | Nhật ký truy cập (Audit Log) |
| QN-50 | Chế độ Chống sao chép |
| QN-51 | Tự động khóa & Đăng xuất bảo mật |
| QN-52 | Phát hiện thông tin nhạy cảm |

**Chi tiết kỹ thuật:**
- **LoginPage** với validation, UX mượt mà
- Trang **DocPermissionsPage** — cấp/thu quyền xem tài liệu theo user/role
- Trang **SecuritySettingsPage** — cấu hình bảo mật hệ thống
- Trang **AuditLogsPage** — xem nhật ký hoạt động
- Tích hợp chế độ Air-Gapped — toàn bộ hoạt động offline không cần internet

### [QN-59] Đóng gói & Bàn giao ✅

| Task | Mô tả |
|---|---|
| QN-60 | Công cụ Sao lưu (Backup) |
| QN-61 | Hướng dẫn sử dụng (Manual) |
| QN-62 | Tài liệu Kỹ thuật (Dev Docs) |
| QN-63 | Lịch sao lưu tự động định kỳ |

**Chi tiết kỹ thuật:**
- Trang **BackupPage** — backup/restore database & vector store
- Viết **Hướng dẫn sử dụng** cho người dùng cuối
- Viết **Tài liệu kỹ thuật** (Dev Docs) cho developer
- Cấu hình lịch sao lưu tự động định kỳ

### Hệ thống phân quyền Action *(ngoài Jira)*

- **`admin_actions.py`** (backend) — API quản lý 50+ action permissions, phân theo nhóm chức năng
- **`ActionPermissionsPage.tsx`** (frontend) — Giao diện cấu hình quyền hành động chi tiết theo từng role

### Giám sát Chat *(ngoài Jira)*

- **`admin_monitor.py`** (backend) — API giám sát toàn bộ chat sessions, stats token/latency từng tin nhắn, resolve feedback
- **`ChatMonitorPage.tsx`** (frontend) — Dashboard xem realtime chat của tất cả người dùng

### Components bổ sung *(ngoài Jira)*

- **`DropZone.tsx`** — Kéo thả tài liệu upload trực tiếp vào workspace
- **`UploadQueuePanel.tsx`** — Theo dõi tiến trình upload & ingestion nhiều file
- **`PermissionMatrix.tsx`** — Bảng phân quyền role-category dạng grid tương tác
- **`SecurityOverlay.tsx`** — Overlay hiển thị khi tài liệu bị hạn chế quyền truy cập
- **`SampleQuestions.tsx`** — Gợi ý câu hỏi mẫu từ AI trong sidebar
- **`RoleSelector.tsx`** — Chọn vai trò AI (Persona) cho phiên chat
- **`ClientWorkspace.tsx`** + **`TopHeader.tsx`** — Layout chính workspace (chat + tài liệu + sidebar)

### 📁 Files phụ trách
```
LocalAIBackend/app/services/
├── hybrid_retriever.py    ✅ Tìm kiếm hybrid vector + BM25
└── vector_store.py        ✅ ChromaDB wrapper

LocalAIBackend/app/api/routes/
├── admin_actions.py       ✅ API phân quyền action theo role
└── admin_monitor.py       ✅ API giám sát chat, stats, feedback

LocalAIFrontend/src/
├── components/
│   ├── chat-panel/        ✅ ChatPanel, MessageBubble, ChatInput, Citations
│   ├── document-panel/    ✅ PDF viewer + SecurityOverlay
│   ├── left-panel/        ✅ Sidebar, DropZone, SampleQuestions, RoleSelector
│   ├── admin/             ✅ PermissionMatrix, UploadQueuePanel, AdminTable
│   └── layout/            ✅ ClientWorkspace, TopHeader
├── pages/
│   ├── LoginPage.tsx      ✅ Đăng nhập
│   ├── DashboardPage.tsx  ✅ Trang chủ
│   ├── WorkspacePage.tsx  ✅ Workspace
│   └── admin/             ✅ 20 trang admin panel (+ EvalPage, ActionPermissionsPage)
├── store/                 ✅ Zustand state management
├── services/              ✅ API calls layer
├── hooks/                 ✅ Custom hooks
└── contexts/              ✅ Auth, theme contexts
```

---

## 📊 Tổng Kết Phân Công

| Thành viên | Epic phụ trách | Số task Jira | Trạng thái |
|---|---|:---:|:---:|
| **Hoàng Văn Tấn Đạt** | QN-1 (Hạ tầng), QN-22 một phần, QN-30 một phần, QN-53 một phần + AI nâng cao | 14 tasks + | ✅ Gần hoàn thành |
| **Cao Minh Đức** | QN-7 (Xử lý dữ liệu), QN-22 một phần, QN-30 một phần, QN-53 một phần | 17 tasks | 🔄 1 task In Progress |
| **Nguyễn Lê Dung** | QN-16 (RAG Index), QN-39 (Workspace), QN-45 (Bảo mật), QN-59 (Bàn giao) + Monitor & Actions | 21 tasks + | ✅ Hoàn thành |

> 📝 *Phân công dựa theo Jira Board (Apr 16, 2026). QN-53 (Giám sát & Chất lượng) đang in-progress — QN-58 Xác nhận của con người chưa hoàn thành.*
