# -*- coding: utf-8 -*-
"""
Seed phong ban mau cho he thong LocalAI.
Chay: python seed_departments.py
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app.db.session import SessionLocal
from app.models.user_model import Department

SAMPLE_DEPARTMENTS = [
    {
        "name": "Ban Giam Doc",
        "description": "Lanh dao cap cao, hoach dinh chien luoc va dieu hanh toan bo hoat dong cong ty",
    },
    {
        "name": "Phong Cong nghe Thong tin",
        "description": "Phat trien phan mem, ha tang he thong va bao mat cong nghe thong tin",
    },
    {
        "name": "Phong Nhan su",
        "description": "Tuyen dung, dao tao, phuc loi va quan ly nguon nhan luc",
    },
    {
        "name": "Phong Tai chinh - Ke toan",
        "description": "Quan ly tai chinh, ke toan, ngan sach va bao cao tai chinh",
    },
    {
        "name": "Phong Kinh doanh",
        "description": "Phat trien thi truong, quan ly khach hang va thuc day doanh so",
    },
    {
        "name": "Phong Marketing",
        "description": "Chien luoc thuong hieu, truyen thong va marketing ky thuat so",
    },
    {
        "name": "Phong Van hanh",
        "description": "Quan ly quy trinh van hanh, hau can va chat luong dich vu",
    },
    {
        "name": "Phong Nghien cuu & Phat trien",
        "description": "Nghien cuu cong nghe moi, AI/ML va phat trien san pham",
    },
]

def seed():
    db = SessionLocal()
    try:
        added = 0
        skipped = 0
        for dept_data in SAMPLE_DEPARTMENTS:
            existing = db.query(Department).filter(Department.name == dept_data["name"]).first()
            if existing:
                print(f"  [SKIP] {dept_data['name']} da ton tai")
                skipped += 1
            else:
                dept = Department(**dept_data)
                db.add(dept)
                print(f"  [ADD]  {dept_data['name']}")
                added += 1
        db.commit()
        print(f"\nHoan thanh: +{added} phong ban moi, {skipped} da ton tai.")
    except Exception as e:
        db.rollback()
        print(f"Loi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Seeding phong ban mau ===\n")
    seed()
