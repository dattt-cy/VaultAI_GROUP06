from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Document Schemas
class DocumentBase(BaseModel):
    title: str
    file_type: str
    category_id: int

class DocumentCreate(DocumentBase):
    file_size_bytes: int
    file_hash: str
    file_path: str
    uploaded_by: int

class Document(DocumentBase):
    id: int
    file_size_bytes: int
    total_tokens: int
    ingestion_status: str
    error_message: Optional[str] = None
    created_at: datetime
    uploaded_by: int

    class Config:
        from_attributes = True

# Document Page (Chunk) Schemas
class DocumentPageBase(BaseModel):
    document_id: int
    chunk_index: int
    raw_content: str
    token_count: int
    page_metadata: Optional[str] = None

class DocumentPageCreate(DocumentPageBase):
    vector_id: str
    chunk_type: str = "flat"
    parent_chunk_id: Optional[int] = None
    child_count: Optional[int] = None

class DocumentPage(DocumentPageBase):
    id: int
    vector_id: str

    class Config:
        from_attributes = True
