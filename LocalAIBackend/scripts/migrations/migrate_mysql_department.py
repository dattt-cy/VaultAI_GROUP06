import pymysql
from app.core.config import settings
from sqlalchemy import create_engine, text

def migrate():
    print("Connecting to database...")
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    with engine.connect() as conn:
        print("Creating departments table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL UNIQUE,
                description TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Check if department_id exists
        check_col = text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'localai' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'department_id'
        """)
        has_dep_id = conn.execute(check_col).fetchone()
        
        if not has_dep_id:
            print("Adding department_id to users...")
            conn.execute(text("ALTER TABLE users ADD COLUMN department_id INT NULL"))
            conn.execute(text("ALTER TABLE users ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES departments(id)"))
            
            # Now migrate data if 'department' column exists
            check_old_col = text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'localai' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'department'
            """)
            has_old_dep = conn.execute(check_old_col).fetchone()
            
            if has_old_dep:
                print("Migrating existing string departments to the new table...")
                users = conn.execute(text("SELECT id, department FROM users WHERE department IS NOT NULL AND department != ''")).fetchall()
                
                for u in users:
                    uid, dname = u[0], u[1]
                    # Insert ignoring duplicates
                    conn.execute(text("INSERT IGNORE INTO departments (name) VALUES (:name)"), {"name": dname})
                    # Get ID
                    dep_id_row = conn.execute(text("SELECT id FROM departments WHERE name = :name"), {"name": dname}).fetchone()
                    if dep_id_row:
                        dep_id = dep_id_row[0]
                        conn.execute(text("UPDATE users SET department_id = :dep_id WHERE id = :uid"), {"dep_id": dep_id, "uid": uid})
                
                print("Dropping old department column...")
                conn.execute(text("ALTER TABLE users DROP COLUMN department"))
        
        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
