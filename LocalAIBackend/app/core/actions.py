"""
Registry của tất cả các action (thao tác) trong hệ thống.
Mỗi action có key duy nhất, nhóm, nhãn hiển thị, và level mặc định tối thiểu.
"""
from dataclasses import dataclass


@dataclass
class ActionDef:
    key: str           # VD: "chat.send"
    label: str         # VD: "Gửi tin nhắn"
    group: str         # VD: "Chat"
    description: str = ""
    default_min_level: int = 1  # level tối thiểu mặc định nếu chưa cấu hình


ACTIONS: list[ActionDef] = [
    # ── Chat ──────────────────────────────────────────────────────────────
    ActionDef("chat.send",           "Gửi tin nhắn",           "Chat",
              "Gửi câu hỏi và nhận câu trả lời từ AI", default_min_level=1),
    ActionDef("chat.view_history",   "Xem lịch sử chat",       "Chat",
              "Xem lại các cuộc trò chuyện cũ", default_min_level=1),
    ActionDef("chat.regenerate",     "Tạo lại câu trả lời",    "Chat",
              "Yêu cầu AI trả lời lại câu hỏi cuối", default_min_level=1),
    ActionDef("chat.export",         "Xuất lịch sử chat",      "Chat",
              "Tải xuống lịch sử trò chuyện", default_min_level=1),

    # ── Tài liệu cá nhân ─────────────────────────────────────────────────
    ActionDef("docs.personal.upload",  "Upload tài liệu cá nhân",  "Tài liệu - Cá nhân",
              "Tải lên tài liệu vào kho cá nhân", default_min_level=1),
    ActionDef("docs.personal.delete",  "Xóa tài liệu cá nhân",    "Tài liệu - Cá nhân",
              "Xóa tài liệu trong kho cá nhân của mình", default_min_level=1),

    # ── Tài liệu công ty ──────────────────────────────────────────────────
    ActionDef("docs.company.view",    "Xem tài liệu công ty",    "Tài liệu - Công ty",
              "Truy cập và đọc tài liệu thuộc kho chung", default_min_level=1),
    ActionDef("docs.company.upload",  "Upload tài liệu công ty", "Tài liệu - Công ty",
              "Tải lên tài liệu vào kho chung của công ty", default_min_level=5),
    ActionDef("docs.company.delete",  "Xóa tài liệu công ty",   "Tài liệu - Công ty",
              "Xóa tài liệu trong kho chung", default_min_level=9),

    # ── Admin - Người dùng ────────────────────────────────────────────────
    ActionDef("admin.users.view",    "Xem danh sách người dùng", "Quản lý - Người dùng",
              "Truy cập trang quản lý tài khoản", default_min_level=9),
    ActionDef("admin.users.create",  "Tạo người dùng mới",       "Quản lý - Người dùng",
              "Thêm tài khoản mới vào hệ thống", default_min_level=9),
    ActionDef("admin.users.edit",    "Chỉnh sửa người dùng",     "Quản lý - Người dùng",
              "Cập nhật thông tin, vai trò, phòng ban của tài khoản", default_min_level=9),
    ActionDef("admin.users.delete",  "Xóa người dùng",           "Quản lý - Người dùng",
              "Xóa tài khoản khỏi hệ thống", default_min_level=9),
    ActionDef("admin.users.toggle",  "Khóa / Mở khóa tài khoản","Quản lý - Người dùng",
              "Vô hiệu hóa hoặc kích hoạt lại tài khoản", default_min_level=9),

    # ── Admin - Vai trò ───────────────────────────────────────────────────
    ActionDef("admin.roles.view",    "Xem vai trò",         "Quản lý - Vai trò",
              "Xem danh sách vai trò và cấp độ", default_min_level=9),
    ActionDef("admin.roles.create",  "Tạo vai trò mới",    "Quản lý - Vai trò",
              "Thêm vai trò mới với cấp độ tùy chỉnh", default_min_level=10),
    ActionDef("admin.roles.edit",    "Chỉnh sửa vai trò",  "Quản lý - Vai trò",
              "Cập nhật tên, cấp độ, mô tả của vai trò", default_min_level=10),
    ActionDef("admin.roles.delete",  "Xóa vai trò",        "Quản lý - Vai trò",
              "Xóa vai trò khỏi hệ thống", default_min_level=10),

    # ── Admin - Phòng ban ─────────────────────────────────────────────────
    ActionDef("admin.departments.view",   "Xem phòng ban",       "Quản lý - Phòng ban",
              "Xem danh sách và thành viên phòng ban", default_min_level=9),
    ActionDef("admin.departments.create", "Tạo phòng ban",       "Quản lý - Phòng ban",
              "Thêm phòng ban mới", default_min_level=9),
    ActionDef("admin.departments.edit",   "Chỉnh sửa phòng ban", "Quản lý - Phòng ban",
              "Cập nhật tên và mô tả phòng ban", default_min_level=9),
    ActionDef("admin.departments.delete", "Xóa phòng ban",       "Quản lý - Phòng ban",
              "Xóa phòng ban khỏi hệ thống", default_min_level=9),

    # ── Admin - Danh mục & Phân quyền tài liệu ────────────────────────────
    ActionDef("admin.categories.manage",  "Quản lý danh mục",         "Quản lý - Tài liệu",
              "Tạo, sửa, xóa danh mục tài liệu", default_min_level=5),
    ActionDef("admin.permissions.view",   "Xem ma trận phân quyền",   "Quản lý - Tài liệu",
              "Xem phân quyền đọc/upload/xóa của từng vai trò theo danh mục", default_min_level=5),
    ActionDef("admin.permissions.edit",   "Chỉnh sửa phân quyền",     "Quản lý - Tài liệu",
              "Cập nhật quyền truy cập tài liệu cho từng vai trò", default_min_level=9),
    ActionDef("admin.doc_perm.manage",    "Phân quyền tài liệu cụ thể","Quản lý - Tài liệu",
              "Cấp quyền truy cập tài liệu riêng lẻ cho user / phòng ban", default_min_level=5),

    # ── Admin - Hệ thống ──────────────────────────────────────────────────
    ActionDef("admin.ai_config.view",  "Xem cấu hình AI",      "Hệ thống",
              "Xem cài đặt mô hình, prompt, tham số AI", default_min_level=9),
    ActionDef("admin.ai_config.edit",  "Chỉnh sửa cấu hình AI","Hệ thống",
              "Thay đổi model, system prompt, nhiệt độ LLM", default_min_level=9),
    ActionDef("admin.rag_config.edit", "Cấu hình RAG",          "Hệ thống",
              "Điều chỉnh pipeline RAG, chunking, retrieval", default_min_level=9),
    ActionDef("admin.chat_monitor",    "Giám sát chat",         "Hệ thống",
              "Xem toàn bộ lịch sử trò chuyện của mọi người dùng", default_min_level=5),
    ActionDef("admin.feedback.view",   "Xem phản hồi",          "Hệ thống",
              "Xem và xử lý phản hồi từ người dùng", default_min_level=5),
    ActionDef("admin.audit_logs",      "Xem nhật ký hệ thống",  "Hệ thống",
              "Tra cứu lịch sử thao tác của mọi tài khoản", default_min_level=9),
    ActionDef("admin.system_metrics",  "Xem tài nguyên hệ thống","Hệ thống",
              "CPU, RAM, disk và các chỉ số hệ thống", default_min_level=9),
    ActionDef("admin.backup",          "Sao lưu & Khôi phục",   "Hệ thống",
              "Tạo và quản lý bản sao lưu dữ liệu", default_min_level=9),
    ActionDef("admin.security",        "Cài đặt bảo mật",       "Hệ thống",
              "Chính sách mật khẩu, session timeout, giới hạn đăng nhập", default_min_level=9),
    ActionDef("admin.eval",            "Đánh giá RAG",          "Hệ thống",
              "Chạy bộ đánh giá chất lượng trả lời RAG", default_min_level=9),
]

# Dict để lookup nhanh
ACTION_MAP: dict[str, ActionDef] = {a.key: a for a in ACTIONS}

# Lấy tất cả group names theo thứ tự xuất hiện
ACTION_GROUPS: list[str] = list(dict.fromkeys(a.group for a in ACTIONS))
