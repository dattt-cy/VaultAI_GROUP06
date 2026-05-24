import pymysql
from app.core.config import settings

def migrate():
    # Parse the SQLALCHEMY_DATABASE_URI: mysql+pymysql://root:1234567890aS@localhost:3306/localai?charset=utf8mb4
    # We can use sqlalchemy to execute raw SQL directly, which is simpler and reuses the connection string.
    from sqlalchemy import create_engine, text
    
    print("Connecting to database...")
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    with engine.connect() as conn:
        print("Checking if avatar_url column exists in users table...")
        
        # Check if column exists
        check_query = text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'localai' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'
        """)
        result = conn.execute(check_query).fetchone()
        
        if result:
            print("Column 'avatar_url' already exists.")
        else:
            print("Adding 'avatar_url' column to 'users' table...")
            alter_query = text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL")
            conn.execute(alter_query)
            conn.commit()
            print("Successfully added 'avatar_url' column.")

if __name__ == "__main__":
    migrate()
