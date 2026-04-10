import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.user_model import User, Role
from app.models.doc_model import Category, Document, DocumentPage
from app.models.chat_model import ChatSession, Message  # Import để load ForeignKey
from app.services.ingestion_service import ingest_file

def run_test():
    print("1. Đang khởi tạo Database Tables (nếu chưa có)...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Tạo dữ liệu giả (Mocks) để đáp ứng Khóa Ngoại (Foreign Keys)
        print("2. Đang nạp dữ liệu Role, User và Category giả mạo để test...")
        # Lấy hoặc tạo Role
        role = db.query(Role).filter_by(name="Admin").first()
        if not role:
            role = Role(name="Admin")
            db.add(role)
            db.commit()
            db.refresh(role)
            
        # Lấy hoặc tạo User
        test_user = db.query(User).filter_by(username="test_user").first()
        if not test_user:
            test_user = User(
                username="test_user", 
                email="test@localai", 
                password_hash="mocked_hash", 
                full_name="Tester", 
                role_id=role.id
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            
        # Lấy hoặc tạo Category
        test_category = db.query(Category).filter_by(name="Tài liệu Test").first()
        if not test_category:
            test_category = Category(name="Tài liệu Test", description="Dùng để chạy Unit Test")
            db.add(test_category)
            db.commit()
            db.refresh(test_category)
            
        # Test Ingest File
        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_test.txt")
        print(f"3. Bắt đầu đẩy dữ liệu từ file: {file_path}")
        
        doc = ingest_file(
            db=db, 
            file_path=file_path, 
            filename="sample_test.txt", 
            file_type="txt", 
            category_id=test_category.id, 
            uploaded_by=test_user.id
        )
        
        print("\n--- KẾT QUẢ ĐÃ LƯU TRONG SQLITE ---")
        print(f"Tên file: {doc.title}")
        print(f"Trạng thái: {doc.ingestion_status}")
        print(f"Mã Băm Hash: {doc.file_hash}")
        print(f"Tổng số token: {doc.total_tokens}")
        
        print("\n--- CHECK BẢNG DOCUMENT PAGES (CHUNKS) ---")
        pages = db.query(DocumentPage).filter_by(document_id=doc.id).all()
        for idx, page in enumerate(pages):
            print(f"\nChunk {idx}:")
            print(f" - Vector ID lưu từ Chroma: {page.vector_id}")
            print(f" - Số Tokens ước tính: {page.token_count}")
            print(f" - Nội dung trích lập thô: {page.raw_content[:50]}...")
            
    except Exception as e:
        print(f"Đã xảy ra lỗi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
