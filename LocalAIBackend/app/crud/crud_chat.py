from sqlalchemy.orm import Session
from app.models.chat_model import ChatSession, Message, MessageCitation
from app.schemas.chat_schema import ChatSessionCreate, MessageCreate, MessageCitationCreate

def create_chat_session(db: Session, obj_in: ChatSessionCreate) -> ChatSession:
    db_obj = ChatSession(**obj_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_chat_sessions_by_user(db: Session, user_id: int):
    return db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).all()

def get_chat_session(db: Session, session_id: int):
    return db.query(ChatSession).filter(ChatSession.id == session_id).first()

def create_message(db: Session, obj_in: MessageCreate) -> Message:
    db_obj = Message(**obj_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    
    # Update session updated_at
    session = db.query(ChatSession).filter(ChatSession.id == obj_in.session_id).first()
    if session:
        session.updated_at = db_obj.created_at
        db.commit()
        
    return db_obj

def create_message_citation(db: Session, obj_in: MessageCitationCreate) -> MessageCitation:
    db_obj = MessageCitation(**obj_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
