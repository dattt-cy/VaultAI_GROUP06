# 📋 Phân Công Công Việc Nhóm — Dự Án LocalAI

> **Dự án**: LocalAI — Hệ thống hỏi-đáp tài liệu nội bộ thông minh (RAG + LLM chạy offline)
> **Nhóm**: 3 thành viên
> **Thời gian**: Học kỳ 1, 2025–2026

---

## 👥 Danh Sách Thành Viên

| STT | Họ và Tên | Vai trò chính |
|:---:|---|---|
| 1 | **Hoàng Văn Tấn Đạt** | AI Engineer — Hệ thống AI lõi & RAG Pipeline |
| 2 | **Cao Minh Đức** | Backend Developer — API Server & Database |
| 3 | **Nguyễn Lê Dung** | Frontend Developer — Giao diện & UX |

---

---

## 🤖 Hoàng Văn Tấn Đạt — AI Engineer

> **Phụ trách**: Toàn bộ hệ thống trí tuệ nhân tạo, pipeline RAG, xử lý ngôn ngữ và tài liệu

### Công việc đã hoàn thành

#### 🧠 RAG Pipeline & Suy Luận
- Thiết kế và xây dựng toàn bộ pipeline RAG (`app/services/rag_pipeline.py`)  
  — Hệ thống hỏi-đáp thông minh: nhận câu hỏi → tìm kiếm tài liệu liên quan → sinh câu trả lời có trích dẫn nguồn
- Xây dựng **Hybrid Retriever** (`hybrid_retriever.py`)  
  — Kết hợp Vector Search (ChromaDB) + BM25 keyword search để tăng độ chính xác tìm kiếm
- Triển khai chiến lược **Parent-Child Chunking**  
  — Child chunk (300 tokens) dùng để tìm kiếm, Parent chunk (800 tokens) dùng để đưa vào LLM context
- Xây dựng **Context Manager** (`context_manager.py`)  
  — Quản lý lịch sử hội thoại, giới hạn context window phù hợp với VRAM

#### 🦙 Tích Hợp LLM (Ollama)
- Xây dựng **LLM Engine** (`llm_engine.py`)  
  — Giao tiếp với Ollama API để gọi model `qwen2.5:7b` và `qwen3:8b`
- Tối ưu tham số inference cho GPU 4GB VRAM (RTX 3050):
  - `num_ctx = 8192` — context window vừa khít VRAM
  - `temperature = 0.1` — giảm hallucination, bám sát tài liệu
  - `num_predict = 4096` — độ dài trả lời đủ chi tiết
- Tích hợp chế độ **Thinking/Reasoning** với `qwen3:8b` (có thể bật/tắt)

#### 📄 Xử Lý & Nhập Tài Liệu
- Xây dựng **Document Parser** (`document_parser.py`)  
  — Hỗ trợ đa dạng định dạng: PDF, Word (.docx), ảnh (OCR), TXT, Markdown
  — Tích hợp **EasyOCR** để nhận dạng văn bản trong hình ảnh, scan
  — Tích hợp **pdfplumber** + **PyMuPDF** để extract text từ PDF
  — Tích hợp **mammoth** để đọc file Word
- Xây dựng **Ingestion Service** (`ingestion_service.py`)  
  — Tự động parse → chunk → embed → lưu vào ChromaDB khi upload tài liệu mới
- Xây dựng **Legal Importer** (`legal_importer.py`)  
  — Nhập hàng loạt văn bản pháp luật từ thư mục `uploads/legal/`

#### 🗄️ Vector Database & Embedding
- Tích hợp và quản lý **ChromaDB** (`vector_store.py`)  
  — Lưu trữ và truy vấn vector embeddings của các đoạn văn bản
- Cấu hình **Embedding Model**: `paraphrase-multilingual-MiniLM-L12-v2`  
  — Model đa ngôn ngữ hỗ trợ tốt tiếng Việt
- Cấu hình **Reranker**: `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`  
  — Tái xếp hạng kết quả tìm kiếm để chọn đoạn văn phù hợp nhất
- Xây dựng **Config Loader** (`config_loader.py`)  
  — Tải cấu hình RAG động từ database (không cần restart server)

#### 📁 Files phụ trách
```
LocalAIBackend/app/services/
├── rag_pipeline.py        ✅ Pipeline RAG chính (~48KB)
├── hybrid_retriever.py    ✅ Tìm kiếm hybrid vector + BM25 (~21KB)
├── llm_engine.py          ✅ Giao tiếp Ollama LLM (~11KB)
├── document_parser.py     ✅ Parse PDF, Word, OCR ảnh (~10KB)
├── ingestion_service.py   ✅ Index tài liệu vào vector DB (~10KB)
├── vector_store.py        ✅ ChromaDB wrapper (~2KB)
├── context_manager.py     ✅ Quản lý context hội thoại (~8KB)
├── config_loader.py       ✅ Load cấu hình RAG động (~3KB)
└── legal_importer.py      ✅ Import văn bản pháp luật (~6KB)
```

---

---

## 🖥️ Cao Minh Đức — Backend Developer

> **Phụ trách**: Xây dựng REST API server, thiết kế cơ sở dữ liệu, hệ thống xác thực và phân quyền

### Công việc đã hoàn thành

#### 🚀 API Server & Cấu Hình
- Khởi tạo và cấu hình **FastAPI** application (`app/main.py`)  
  — Đăng ký toàn bộ router, middleware CORS, static files
- Cấu hình **Uvicorn** ASGI server (`main.py`)  
  — Hot-reload cho môi trường development
- Thiết kế cấu hình tập trung (`app/core/config.py`)  
  — Quản lý tất cả biến môi trường: DB URI, JWT secret, Ollama URL, LLM params
- Xây dựng hệ thống **migration tự động**  
  — Tự động thêm cột mới vào bảng khi nâng cấp phiên bản (không mất dữ liệu)
- Seed dữ liệu khởi tạo tự động (admin account, LLM config mặc định, System Prompt)

#### 🗃️ Database Design & ORM
- Thiết kế toàn bộ **database schema** với SQLAlchemy:

  | Model | Bảng | Mô tả |
  |---|---|---|
  | `user_model.py` | `users`, `roles` | Người dùng, vai trò, phân cấp quyền |
  | `doc_model.py` | `documents`, `chunks`, `categories`, `departments` | Tài liệu, phân loại |
  | `chat_model.py` | `conversations`, `messages`, `feedbacks` | Lịch sử chat, phản hồi |
  | `sys_model.py` | `llm_configs`, `system_prompts`, `rag_configs`, `audit_logs` | Cấu hình hệ thống |

- Quản lý **session database** (`db/session.py`) — connection pool, SessionLocal
- Xây dựng **CRUD operations** (`crud/`) — các hàm thao tác DB tái sử dụng được

#### 🔐 Bảo Mật & Xác Thực
- Xây dựng hệ thống **JWT Authentication** (`api/routes/auth.py`, `core/security.py`)  
  — Đăng nhập → cấp access token (8 ngày) → xác thực mọi request
- Triển khai **bcrypt password hashing** (`passlib[bcrypt]`)  
  — Mã hóa an toàn mật khẩu người dùng
- Xây dựng **hệ thống phân quyền theo cấp độ** (`api/dependencies.py`)  
  — Access level từ 1 (user) đến 10 (admin), middleware `require_min_level(n)`
- Quản lý **Security Settings** (`admin_security.py`)  
  — Cấu hình bảo mật, audit logs, giám sát hoạt động

#### 📡 API Endpoints
- **Auth API** (`auth.py`): Đăng nhập, đăng xuất, lấy thông tin user hiện tại
- **Documents API** (`documents.py`, ~20KB): Upload, download, xóa tài liệu; gắn category/department; phân quyền xem
- **Chat API** (`chat.py`, ~13KB): Gửi câu hỏi → gọi RAG pipeline → trả lời; quản lý hội thoại; feedback
- **Admin API** (`admin.py`, ~44KB): CRUD users, roles, categories, departments, system prompts
- **Admin Ollama** (`admin_ollama.py`): Liệt kê, pull, xóa model Ollama
- **Admin RAG Config** (`admin_rag_config.py`): Cấu hình tham số RAG qua giao diện web
- **Admin Backup** (`admin_backup.py`): Backup/restore database và vector store
- **Admin Security** (`admin_security.py`): Cấu hình bảo mật, xem audit logs
- **Admin Legal Import** (`admin_legal_import.py`): Trigger import văn bản pháp luật hàng loạt

#### 📁 Files phụ trách
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
    ├── models/
    │   ├── user_model.py           ✅ User, Role schema
    │   ├── doc_model.py            ✅ Document, Chunk schema
    │   ├── chat_model.py           ✅ Conversation, Message schema
    │   └── sys_model.py            ✅ LlmConfig, SystemPrompt schema
    ├── crud/                       ✅ Database CRUD operations
    ├── schemas/                    ✅ Pydantic request/response schemas
    └── api/
        ├── dependencies.py         ✅ Auth middleware, permission levels
        └── routes/
            ├── auth.py             ✅ Xác thực JWT
            ├── documents.py        ✅ Quản lý tài liệu
            ├── chat.py             ✅ Chat & RAG endpoint
            ├── admin.py            ✅ Quản trị tổng hợp
            ├── admin_ollama.py     ✅ Quản lý Ollama model
            ├── admin_rag_config.py ✅ Cấu hình RAG
            ├── admin_backup.py     ✅ Backup hệ thống
            ├── admin_security.py   ✅ Cài đặt bảo mật
            └── admin_legal_import.py ✅ Import pháp luật
```

---

---

## 🎨 Nguyễn Lê Dung — Frontend Developer

> **Phụ trách**: Toàn bộ giao diện người dùng, trải nghiệm UX, tích hợp API backend

### Công việc đã hoàn thành

#### 🏗️ Khởi Tạo & Cấu Hình Dự Án
- Khởi tạo project với **Vite + React 19 + TypeScript**  
  — Build tool hiện đại, hot module replacement cực nhanh
- Cấu hình **TailwindCSS** + **PostCSS** + **Autoprefixer**  
  — Design system utility-first, responsive layout
- Cấu hình **ESLint + TypeScript-ESLint**  
  — Đảm bảo code chất lượng, type-safe
- Tích hợp **Material UI (MUI v9)** + **Emotion**  
  — Component library premium cho admin dashboard
- Cấu hình **React Router DOM v7**  
  — Client-side routing, protected routes phân quyền

#### 💬 Giao Diện Chat (Core Feature)
- **ChatPanel** (`components/chat-panel/ChatPanel.tsx`, ~11KB)  
  — Màn hình chat chính, hiển thị lịch sử hội thoại
- **MessageBubble** (`MessageBubble.tsx`, ~21KB)  
  — Hiển thị tin nhắn user/AI với Markdown rendering, code highlighting
- **ChatInput** (`ChatInput.tsx`, ~16KB)  
  — Ô nhập câu hỏi, hỗ trợ multiline, gửi bằng Enter/Shift+Enter
- **CitationPopup** + **CitationTag** (`CitationPopup.tsx`, `CitationTag.tsx`)  
  — Hiển thị trích dẫn nguồn tài liệu khi AI trả lời (click để xem chi tiết)
- **ChatActions** (`ChatActions.tsx`, ~8KB)  
  — Các hành động: copy, thumbs up/down (feedback), xuất báo cáo
- **ReportDialog** (`ReportDialog.tsx`)  
  — Dialog báo cáo câu trả lời không phù hợp
- **DataTable** + **ExportButtons**  
  — Hiển thị dữ liệu dạng bảng, xuất Excel/PDF

#### 📄 Giao Diện Xem Tài Liệu
- **Document Panel** (`components/document-panel/`)  
  — Panel xem file PDF trực tiếp trong trình duyệt (`react-pdf`)
  — Xem song song tài liệu và chat (split-view layout)

#### 🗂️ Giao Diện Quản Lý Workspace
- **DashboardPage** (`pages/DashboardPage.tsx`, ~12KB)  
  — Trang chủ chính với sidebar hội thoại, workspace tài liệu
- **WorkspacePage** (`pages/WorkspacePage.tsx`)  
  — Không gian làm việc tổng hợp
- **LoginPage** (`pages/LoginPage.tsx`, ~5KB)  
  — Form đăng nhập với validation, UX mượt mà
- **Left Panel** (`components/left-panel/`)  
  — Sidebar danh sách hội thoại, tìm kiếm, tạo mới

#### 🛠️ Trang Quản Trị Admin (18 trang)

| Trang | File | Mô tả |
|---|---|---|
| Tổng quan | `OverviewPage.tsx` (~16KB) | Dashboard thống kê hệ thống |
| Người dùng | `UsersPage.tsx` (~30KB) | CRUD users, đổi role, khóa tài khoản |
| Vai trò | `RolesPage.tsx` (~14KB) | Quản lý roles & access levels |
| Tài liệu | `DocumentsPage.tsx` (~36KB) | Upload, phân loại, phân quyền tài liệu |
| Phân quyền | `DocPermissionsPage.tsx` (~19KB) | Cấp/thu quyền xem tài liệu theo user/role |
| Phòng ban | `DepartmentsPage.tsx` (~24KB) | Quản lý phòng ban tổ chức |
| Danh mục | `CategoriesPage.tsx` (~8KB) | Quản lý danh mục tài liệu |
| Cấu hình AI | `AIConfigPage.tsx` (~12KB) | Chỉnh sửa System Prompt, thông số LLM |
| Cấu hình RAG | `RAGConfigPage.tsx` (~10KB) | Tùy chỉnh chunking, retrieval, reranker |
| Quản lý Model | `ModelManagementPage.tsx` (~16KB) | Pull/xóa model Ollama, chọn model active |
| Giám sát Chat | `ChatMonitorPage.tsx` (~12KB) | Xem toàn bộ lịch sử chat người dùng |
| Phản hồi | `FeedbackPage.tsx` (~20KB) | Xem & xử lý feedback câu trả lời |
| Nhập pháp luật | `LegalImportPage.tsx` (~17KB) | Import hàng loạt văn bản pháp luật |
| Backup | `BackupPage.tsx` (~13KB) | Backup/restore database & vector store |
| Bảo mật | `SecuritySettingsPage.tsx` (~15KB) | Cấu hình bảo mật hệ thống |
| Audit Logs | `AuditLogsPage.tsx` (~7KB) | Xem nhật ký hoạt động hệ thống |
| Hiệu năng | `SystemMetricsPage.tsx` (~9KB) | Giám sát CPU, RAM, GPU usage |
| Layout Admin | `AdminLayout.tsx` (~7KB) | Khung layout chung cho admin panel |

#### 🔧 Hạ Tầng Frontend
- **State Management** (`src/store/`)  
  — Zustand stores: auth state, chat state, UI state
- **React Context** (`src/contexts/`)  
  — Auth context, theme context
- **Custom Hooks** (`src/hooks/`)  
  — Reusable logic: useAuth, useFetch, useDebounce...
- **API Service Layer** (`src/services/`)  
  — Tập trung tất cả HTTP calls đến backend API
- **MUI Theme** (`src/theme/`)  
  — Customization theme Material UI theo brand
- **Utility Functions** (`src/utils/`, `src/lib/`)  
  — Helper functions, cn() merger, date formatting...
- **Mock Data** (`src/mocks/`)  
  — Dữ liệu giả cho development/testing

#### 📁 Files phụ trách
```
LocalAIFrontend/
├── index.html                         ✅ HTML entry point
├── package.json                       ✅ Dependencies & scripts
├── vite.config.ts                     ✅ Vite build config
├── tailwind.config.js                 ✅ TailwindCSS config
├── tsconfig*.json                     ✅ TypeScript config
├── eslint.config.js                   ✅ ESLint rules
└── src/
    ├── main.tsx                       ✅ React root entry
    ├── App.tsx                        ✅ Root component & routes
    ├── index.css                      ✅ Global styles, Tailwind
    ├── components/
    │   ├── chat-panel/                ✅ 9 components chat (~73KB)
    │   ├── document-panel/            ✅ PDF viewer component
    │   ├── left-panel/                ✅ Sidebar hội thoại
    │   └── layout/                   ✅ Layout wrapper
    ├── pages/
    │   ├── LoginPage.tsx              ✅ Trang đăng nhập
    │   ├── DashboardPage.tsx          ✅ Trang chủ
    │   ├── WorkspacePage.tsx          ✅ Workspace
    │   └── admin/ (18 trang)         ✅ Toàn bộ admin panel
    ├── contexts/                      ✅ React contexts
    ├── hooks/                         ✅ Custom hooks
    ├── store/                         ✅ Zustand state
    ├── theme/                         ✅ MUI theme
    ├── services/                      ✅ API calls layer
    ├── routes/                        ✅ Route definitions
    └── utils/ & lib/                  ✅ Utility functions
```

---

## 📊 Tổng Kết Phân Công

| Thành viên | Lĩnh vực | Số file chính | Tỉ lệ đóng góp ước tính |
|---|---|:---:|:---:|
| **Hoàng Văn Tấn Đạt** | AI Core / RAG / LLM | 9 files (~128KB) | ~35% |
| **Cao Minh Đức** | Backend API / Database / Auth | 15+ files (~110KB) | ~32% |
| **Nguyễn Lê Dung** | Frontend / UI / UX | 30+ files (~450KB) | ~33% |

---

> 📝 *File phân công này ghi lại những công việc đã hoàn thành trong quá trình phát triển dự án LocalAI.*
> *Mọi thành viên đều phối hợp, hỗ trợ lẫn nhau trong quá trình tích hợp và kiểm thử hệ thống.*
