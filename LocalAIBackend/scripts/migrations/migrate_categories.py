"""
Migration: Phân loại lại documents từ 'Tài liệu Test' vào đúng category.
Các file personal_* được chuyển sang PERSONAL scope.
"""
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

DB_PATH = "localai.db"

# Mapping: title (khớp theo prefix/contains) -> category_id
# Categories hiện có: NHÂN SỰ=2, TÀI CHÍNH=3, IT=4, Chung=5
COMPANY_MAPPING = [
    # NHÂN SỰ
    ("Chinh_sach_luong_thuong",   2),
    ("Ke_hoach_phat_trien",       2),
    ("Quy_che_lao_dong",          2),
    # TÀI CHÍNH
    ("Bao_cao_doanh_thu",         3),
    ("Quy_trinh_thanh_toan",      3),
    ("Bao_cao_kinh_te",           3),
    ("Báo_cáo_kinh_tế",           3),
    ("BaoCao_KTKT",               3),
    # IT
    ("Getting_Started",           4),
    ("Huong_dan_bao_mat",         4),
    ("Huong_dan_su_dung",         4),
    ("He_thong_quan_ly",          4),
    ("Chuong_5_6",                4),
]

PERSONAL_PREFIX = "personal_"


def migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Lấy tất cả docs đang ở category "Tài liệu Test" (id=1)
    c.execute(
        "SELECT id, title, document_scope, uploaded_by FROM documents WHERE category_id = 1"
    )
    docs = c.fetchall()
    print(f"Tìm thấy {len(docs)} documents trong 'Tài liệu Test'\n")

    personal_moved = []
    company_moved = []
    unmatched = []

    for doc in docs:
        doc_id, title, scope, uploaded_by = doc["id"], doc["title"], doc["document_scope"], doc["uploaded_by"]

        # --- Personal files ---
        if title.startswith(PERSONAL_PREFIX):
            # Tìm session gần nhất của user đã upload
            c.execute(
                "SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                (uploaded_by,),
            )
            session_row = c.fetchone()
            session_id = session_row["id"] if session_row else None

            c.execute(
                "UPDATE documents SET document_scope='PERSONAL', category_id=NULL, session_id=? WHERE id=?",
                (session_id, doc_id),
            )
            personal_moved.append(f"  [{doc_id}] {title} → PERSONAL (session={session_id})")
            continue

        # --- Company files: khớp mapping ---
        matched = False
        for keyword, cat_id in COMPANY_MAPPING:
            if keyword.lower() in title.lower():
                c.execute(
                    "UPDATE documents SET category_id=? WHERE id=?",
                    (cat_id, doc_id),
                )
                c.execute("SELECT name FROM categories WHERE id=?", (cat_id,))
                cat_name = c.fetchone()["name"]
                company_moved.append(f"  [{doc_id}] {title} → {cat_name}")
                matched = True
                break

        if not matched:
            # Fallback: đưa vào Chung
            c.execute("UPDATE documents SET category_id=5 WHERE id=?", (doc_id,))
            unmatched.append(f"  [{doc_id}] {title} → Chung (fallback)")

    conn.commit()
    conn.close()

    print("=== PERSONAL (đã chuyển scope) ===")
    print("\n".join(personal_moved) or "  (none)")
    print("\n=== COMPANY (đã phân category) ===")
    print("\n".join(company_moved) or "  (none)")
    if unmatched:
        print("\n=== FALLBACK → Chung ===")
        print("\n".join(unmatched))

    print(f"\nHoàn tất: {len(personal_moved)} personal, {len(company_moved)} company, {len(unmatched)} fallback")


if __name__ == "__main__":
    migrate()
