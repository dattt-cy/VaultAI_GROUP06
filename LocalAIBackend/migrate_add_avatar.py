"""Add avatar_url column to users table."""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "localai.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("PRAGMA table_info(users)")
cols = [row[1] for row in cur.fetchall()]
if "avatar_url" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)")
    conn.commit()
    print("Added avatar_url column.")
else:
    print("avatar_url already exists.")
conn.close()
