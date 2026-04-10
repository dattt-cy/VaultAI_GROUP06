from sqlalchemy.orm import Session
from app.models.doc_model import Document, DocumentPage, Category
from app.schemas.doc_schema import DocumentCreate, DocumentPageCreate

def create_document(db: Session, obj_in: DocumentCreate) -> Document:
    db_obj = Document(**obj_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_documents(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Document).offset(skip).limit(limit).all()

def update_document_status(db: Session, db_obj: Document, status: str, total_tokens: int = 0, error: str = None):
    db_obj.ingestion_status = status
    if total_tokens:
        db_obj.total_tokens = total_tokens
    if error:
        db_obj.error_message = error
    db.commit()
    db.refresh(db_obj)
    return db_obj

def create_document_page(db: Session, obj_in: DocumentPageCreate) -> DocumentPage:
    db_obj = DocumentPage(**obj_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
