import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.chat_model import ChatSession, Message  # Cần import để SQLAlchemy load bảng chat_sessions
from app.models.user_model import User
from app.models.doc_model import Category
from app.services.ingestion_service import ingest_file

def run_ingest():
    db = SessionLocal()
    try:
        # Lấy user và category (Mặc định lấy dòng đầu tiên có sẵn trong db)
        test_user = db.query(User).first()
        test_category = db.query(Category).first()
        
        if not test_user:
            print("Lỗi: Không tìm thấy người dùng nào trong database.")
            return
            
        file_path = r"E:\HK12025-2026\DUANLOCALAI\Tiensi.pdf"
        print(f"Bắt đầu nạp file: {file_path}")
        
        doc = ingest_file(
            db=db, 
            file_path=file_path, 
            filename="Tiensi.pdf", 
            file_type="pdf", 
            category_id=test_category.id if test_category else None, 
            uploaded_by=test_user.id
        )
        
        print("\n--- KẾT QUẢ ĐÃ LƯU TRONG CƠ SỞ DỮ LIỆU ---")
        print(f"ID: {doc.id}")
        print(f"Tên file: {doc.title}")
        print(f"Trạng thái: {doc.ingestion_status}")
        print(f"Tổng số token: {doc.total_tokens}")
            
    except Exception as e:
        print(f"Đã xảy ra lỗi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_ingest()
