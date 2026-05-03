from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    documents = relationship("Document", back_populates="category")

class CategoryPermission(Base):
    __tablename__ = "category_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    can_view = Column(Boolean, default=True)
    can_upload = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(250), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    
    # User requested: "Bỏ UNIQUE để nhiều người có thể tự tải cùng một tệp cá nhân"
    file_hash = Column(String(256), nullable=False)
    file_path = Column(Text, nullable=False)
    
    total_tokens = Column(Integer, default=0)
    document_scope = Column(String(50), default='PERSONAL') # PERSONAL or COMPANY
    
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    ingestion_status = Column(String(50), default="PENDING")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    category = relationship("Category", back_populates="documents")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")

class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    raw_content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False)
    page_metadata = Column(Text, nullable=True)
    vector_id = Column(String(100), unique=True, nullable=False)

    # Parent-child chunking
    chunk_type = Column(String(10), nullable=False, default="flat")
    # "parent" — chunk lớn đưa vào LLM context
    # "child"  — chunk nhỏ dùng để embed + retrieval
    # "flat"   — legacy rows (hoạt động như parent trong retrieval)
    parent_chunk_id = Column(Integer, ForeignKey("document_pages.id", ondelete="SET NULL"), nullable=True)
    child_count = Column(Integer, nullable=True)  # chỉ set trên parent rows

    document = relationship("Document", back_populates="pages")
    parent = relationship("DocumentPage", remote_side=[id], back_populates="children", foreign_keys=[parent_chunk_id])
    children = relationship("DocumentPage", back_populates="parent")
