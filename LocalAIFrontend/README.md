# 🎨 LocalAI Frontend

Giao diện người dùng của hệ thống **LocalAI** — ứng dụng hỏi-đáp tài liệu nội bộ thông minh, xây dựng bằng React + TypeScript + Vite + TailwindCSS.

---

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [Cấu hình](#cấu-hình)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Build Production](#build-production)

---

## 🔍 Tổng quan

Frontend cung cấp giao diện web hiện đại cho hệ thống LocalAI, bao gồm:

- Giao diện chat hỏi-đáp với AI, hiển thị câu trả lời có trích dẫn nguồn
- Upload và quản lý tài liệu nội bộ
- Xem tài liệu PDF trực tiếp trên trình duyệt
- Bảng điều khiển Admin: quản lý users, cấu hình LLM, RAG, backup
- Hệ thống phân quyền (admin / user thường)

---

## 🛠️ Công nghệ sử dụng

### Core Framework

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **React** | ^19.2.4 | UI framework chính |
| **TypeScript** | ~6.0.2 | Type-safe JavaScript |
| **Vite** | ^8.0.4 | Build tool & dev server (cực nhanh) |
| **React Router DOM** | ^7.14.0 | Client-side routing, điều hướng trang |

### UI / Styling

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **TailwindCSS** | ^3.4.19 | Utility-first CSS framework |
| **PostCSS** | ^8.5.9 | CSS processing pipeline |
| **Autoprefixer** | ^10.4.27 | Tự động thêm CSS vendor prefixes |
| **Material UI (MUI)** | ^9.0.0 | Component library (Button, Dialog, Table...) |
| **@emotion/react** | ^11.14.0 | CSS-in-JS runtime cho MUI |
| **@emotion/styled** | ^11.14.1 | Styled components cho MUI |
| **@mui/icons-material** | ^9.0.0 | Bộ icon Material Design |
| **Lucide React** | ^1.7.0 | Icon library bổ sung |

### State Management

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **Zustand** | ^5.0.12 | State management nhẹ, đơn giản |

### Utilities

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **class-variance-authority (CVA)** | ^0.7.1 | Quản lý class variant cho component |
| **clsx** | ^2.1.1 | Utility ghép className có điều kiện |
| **tailwind-merge** | ^3.5.0 | Merge Tailwind classes, tránh conflict |

### Hiển thị nội dung

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **react-markdown** | ^10.1.0 | Render Markdown từ AI response |
| **react-pdf** | ^10.4.1 | Xem file PDF trực tiếp trong trình duyệt |

### Dev Tools & Linting

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **ESLint** | ^9.39.4 | Linting JavaScript/TypeScript |
| **typescript-eslint** | ^8.58.0 | TypeScript rules cho ESLint |
| **eslint-plugin-react-hooks** | ^7.0.1 | Kiểm tra React Hooks rules |
| **eslint-plugin-react-refresh** | ^0.5.2 | HMR (Hot Module Replacement) support |
| **@vitejs/plugin-react** | ^6.0.1 | Vite plugin cho React (Fast Refresh) |

---

## 💻 Yêu cầu hệ thống

- **Node.js**: 18.x hoặc mới hơn (khuyến nghị 20.x LTS)
- **npm**: 9.x+ (đi kèm Node.js) hoặc **yarn** / **pnpm**
- **Backend**: Đảm bảo [LocalAI Backend](../LocalAIBackend/README.md) đang chạy tại `http://localhost:8000`

---

## 🚀 Cài đặt và chạy

### 1. Di chuyển vào thư mục frontend

```bash
cd LocalAIFrontend
```

### 2. Cài đặt dependencies

```bash
npm install
```

> Nếu gặp lỗi peer dependency, thêm flag `--legacy-peer-deps`:
> ```bash
> npm install --legacy-peer-deps
> ```

### 3. Cấu hình API URL (nếu cần)

Mặc định frontend gọi API tại `http://localhost:8000`. Nếu backend chạy ở địa chỉ khác, tạo file `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

> Xem thêm phần [Cấu hình](#cấu-hình).

### 4. Chạy Development Server

```bash
npm run dev
```

Ứng dụng sẽ khởi động tại: **http://localhost:5173**

Vite sẽ tự động reload khi có thay đổi code (Hot Module Replacement).

### 5. Đăng nhập

Sử dụng tài khoản mặc định được tạo bởi backend:

```
Username: admin
Password: admin123
```

---

## ⚙️ Cấu hình

Tạo file `.env.local` (không commit file này lên git) để ghi đè cấu hình:

```env
# URL của LocalAI Backend API
VITE_API_BASE_URL=http://localhost:8000
```

> Các biến môi trường cho Vite **bắt buộc phải có tiền tố `VITE_`** mới được expose ra phía client.

---

## 📁 Cấu trúc thư mục

```
LocalAIFrontend/
├── index.html                  # HTML entry point
├── package.json                # Dependencies & scripts
├── vite.config.ts              # Vite build config
├── tailwind.config.js          # TailwindCSS config
├── postcss.config.js           # PostCSS config
├── tsconfig.json               # TypeScript config gốc
├── tsconfig.app.json           # TypeScript config cho app
├── tsconfig.node.json          # TypeScript config cho Node (vite.config)
├── eslint.config.js            # ESLint config
├── public/                     # Static assets (không qua Vite build)
└── src/
    ├── main.tsx                # React entry point (render root)
    ├── App.tsx                 # Root component, route setup
    ├── App.css                 # Global styles
    ├── index.css               # TailwindCSS directives & base styles
    ├── assets/                 # Hình ảnh, font, icon tĩnh
    ├── components/             # Shared/reusable UI components
    ├── contexts/               # React Context (auth context, theme...)
    ├── features/               # Feature-based modules (chat, docs, admin...)
    ├── hooks/                  # Custom React hooks
    ├── lib/                    # Utility functions, helpers
    ├── mocks/                  # Mock data cho development/testing
    ├── pages/                  # Page-level components (mapping với routes)
    ├── routes/                 # React Router route definitions
    ├── services/               # API service layer (axios/fetch calls)
    ├── store/                  # Zustand global state stores
    ├── theme/                  # MUI theme customization
    └── utils/                  # Các utility functions chung
```

---

## 📜 Scripts

| Script | Lệnh | Mô tả |
|---|---|---|
| **dev** | `npm run dev` | Chạy dev server với HMR |
| **build** | `npm run build` | Build production (TypeScript compile + Vite bundle) |
| **preview** | `npm run preview` | Preview bản build production locally |
| **lint** | `npm run lint` | Chạy ESLint kiểm tra code |

---

## 📦 Build Production

```bash
# Build ra thư mục dist/
npm run build

# Preview bản build trước khi deploy
npm run preview
```

Kết quả build nằm trong thư mục `dist/`. Có thể deploy lên bất kỳ static hosting nào (Nginx, Apache, Vercel, Netlify...).

### Cấu hình Nginx mẫu

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/localai/dist;
    index index.html;

    # SPA routing — redirect 404 về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls về Backend
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🤝 Lưu ý khi phát triển

1. **Backend phải chạy trước**: Frontend cần Backend ở `localhost:8000` để hoạt động. Xem [LocalAI Backend README](../LocalAIBackend/README.md).
2. **CORS**: Backend mặc định cho phép `localhost:5173` và `localhost:5174`.
3. **React 19**: Dự án dùng React 19 — một số thư viện cũ có thể chưa tương thích hoàn toàn. Dùng `--legacy-peer-deps` nếu cần.
4. **TypeScript Strict**: Dự án dùng TypeScript strict mode — đảm bảo type đúng khi thêm code mới.
5. **Vite HMR**: Hot reload hoạt động tốt với React + Vite. Không cần refresh thủ công khi sửa code.
