from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    access_level = Column(Integer, default=1)
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="role")
    action_permissions = relationship("RoleAction", back_populates="role", cascade="all, delete-orphan")


class RoleAction(Base):
    """Phân quyền action cụ thể cho từng role. Nếu không có row thì dùng default_min_level."""
    __tablename__ = "role_actions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    action_key = Column(String(100), nullable=False)
    allowed = Column(Boolean, default=True, nullable=False)

    role = relationship("Role", back_populates="action_permissions")

class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    users = relationship("User", back_populates="department")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(250), unique=True, index=True, nullable=True)
    password_hash = Column(String(256), nullable=False)
    full_name = Column(String(150), nullable=False)
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    avatar_url = Column(String(500), nullable=True)
    
    role = relationship("Role", back_populates="users")
    department = relationship("Department", back_populates="users")
