from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey
from datetime import datetime
from app.db.base import Base

class LlmConfig(Base):
    __tablename__ = "llm_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False)
    quantization_method = Column(String(50), nullable=True)
    temperature = Column(Float, default=0.7)
    top_p = Column(Float, default=0.9)
    top_k = Column(Integer, default=40)
    repetition_penalty = Column(Float, default=1.1)
    context_window_limit = Column(Integer, default=4096)
    max_new_tokens = Column(Integer, default=1024)
    
    is_active = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SystemPrompt(Base):
    __tablename__ = "system_prompts"

    id = Column(Integer, primary_key=True, index=True)
    version_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    prompt_content = Column(Text, nullable=False)
    
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(String(100), nullable=True)
    details_json = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
