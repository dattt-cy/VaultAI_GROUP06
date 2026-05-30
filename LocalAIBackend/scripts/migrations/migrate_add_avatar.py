"""Add avatar_url column to users table (MySQL)."""
import os
import pymysql

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "localai")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "1234567890aS")

conn = pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME)
cur = conn.cursor()
cur.execute("SHOW COLUMNS FROM users LIKE 'avatar_url'")
if cur.fetchone() is None:
    cur.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)")
    conn.commit()
    print("Added avatar_url column.")
else:
    print("avatar_url already exists.")
cur.close()
conn.close()
