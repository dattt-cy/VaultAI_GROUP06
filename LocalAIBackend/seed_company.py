import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal, engine
from app.db.base import Base

# Import all models to ensure metadata is registered correctly for Foreign Keys
from app.models.user_model import User, Role
from app.models.doc_model import Category, Document
from app.models.chat_model import ChatSession, Message
from app.services.ingestion_service import ingest_file

def seed():
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("1. Đảm bảo có User id=1")
        role = db.query(Role).first()
        if not role:
            role = Role(name="Admin")
            db.add(role)
            db.commit()
            db.refresh(role)
            
        user = db.query(User).filter_by(id=1).first()
        if not user:
            user = User(username="admin", email="admin@local", full_name="Admin", role_id=role.id, password_hash="123")
            db.add(user)
            db.commit()
    
        print("2. Tạo thư mục seed và files...")
        seed_dir = "./seed_files"
        os.makedirs(seed_dir, exist_ok=True)
        
        files = [
            ("Quy_che_lao_dong_2024.txt", "NHÂN SỰ", "Đây là quy chế lao động năm 2024. Thời gian làm việc từ 8h sáng đến 5h chiều. Nhân viên được nghỉ phép 12 ngày/năm."),
            ("Chinh_sach_bao_hiem.txt", "NHÂN SỰ", "Chi tiết chính sách bảo hiểm thai sản và bảo hiểm thất nghiệp cho năm 2024."),
            ("Bao_cao_doanh_thu_Q1.txt", "TÀI CHÍNH", "Doanh thu quý 1 đạt 10 tỷ VNĐ. Tăng trưởng 15% so với cùng kỳ năm trước."),
            ("Huong_dan_bao_mat_IT.txt", "IT", "Mọi nhân viên cần đổi mật khẩu 3 tháng/lần và không dùng chung tài khoản.")
        ]
        
        cat_map = {}
        for fname, cat_name, content in files:
            # Tạo file vật lý
            path = os.path.join(seed_dir, fname)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            
            # Đảm bảo category tồn tại
            cat = db.query(Category).filter_by(name=cat_name).first()
            if not cat:
                cat = Category(name=cat_name, description=f"Thư mục {cat_name}")
                db.add(cat)
                db.commit()
                db.refresh(cat)
            cat_map[fname] = cat.id
            
        print("3. Ingesting files vào COMPANY scope...")
        for fname, cat_name, content in files:
            path = os.path.join(seed_dir, fname)
            # ingest
            doc = ingest_file(
                db=db,
                file_path=path,
                filename=fname,
                file_type="txt",
                category_id=cat_map[fname],
                uploaded_by=1
            )
            # set scope to COMPANY
            doc.document_scope = "COMPANY"
            db.commit()
            print(f" - Đã thêm {fname} vào thư mục {cat_name}")
            
        print("XONG!")
        
    except Exception as e:
        print("LỖI:", e)
    finally:
        db.close()

if __name__ == '__main__':
    seed()
