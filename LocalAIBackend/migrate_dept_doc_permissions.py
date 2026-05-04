"""
Migration: tao bang department_doc_permissions
Chay: python migrate_dept_doc_permissions.py
"""
from app.db.session import SessionLocal
from app.db.base import Base
from app.models.doc_model import DepartmentDocPermission  # noqa: trigger model registration
from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    print("Connecting to database...")
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    with engine.connect() as conn:
        print("Creating department_doc_permissions table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS department_doc_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                department_id INT NOT NULL,
                document_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_ddp_dept FOREIGN KEY (department_id)
                    REFERENCES departments(id) ON DELETE CASCADE,
                CONSTRAINT fk_ddp_doc FOREIGN KEY (document_id)
                    REFERENCES documents(id) ON DELETE CASCADE,
                UNIQUE KEY uq_dept_doc (department_id, document_id)
            )
        """))
        conn.commit()
        print("Done! Table department_doc_permissions created.")

if __name__ == "__main__":
    migrate()
