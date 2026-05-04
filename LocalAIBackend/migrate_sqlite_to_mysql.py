"""
Migrate data from SQLite to MySQL.
Run once: python migrate_sqlite_to_mysql.py
"""
import sqlite3
from sqlalchemy import create_engine, text

SQLITE_URI = "sqlite:///./localai.db"
MYSQL_URI = "mysql+pymysql://root:1234567890aS@localhost:3306/localai?charset=utf8mb4"

TABLES = [
    "roles",
    "users",
    "chat_sessions",
    "categories",
    "category_permissions",
    "documents",
    "document_pages",
    "messages",
    "message_citations",
    "feedbacks",
    "llm_configs",
    "system_prompts",
]

def migrate():
    sqlite_conn = sqlite3.connect("./localai.db")
    sqlite_conn.row_factory = sqlite3.Row
    mysql_engine = create_engine(MYSQL_URI)

    with mysql_engine.begin() as mysql_conn:
        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

        for table in reversed(TABLES):
            mysql_conn.execute(text(f"TRUNCATE TABLE `{table}`"))
            print(f"  {table}: truncated")

        for table in TABLES:
            cursor = sqlite_conn.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            if not rows:
                print(f"  {table}: empty, skipping")
                continue

            cols = [d[0] for d in cursor.description]
            placeholders = ", ".join([f":{c}" for c in cols])
            col_names = ", ".join([f"`{c}`" for c in cols])
            sql = text(f"INSERT IGNORE INTO `{table}` ({col_names}) VALUES ({placeholders})")

            data = [dict(zip(cols, row)) for row in rows]
            mysql_conn.execute(sql, data)
            print(f"  {table}: {len(data)} rows migrated")

        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    sqlite_conn.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
