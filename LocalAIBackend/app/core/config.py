import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Local AI Backend"
    API_V1_STR: str = "/api/v1"
    
    # Database
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./localai.db"
    
    # Vector DB
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    
    # Security
    SECRET_KEY: str = "this_is_a_very_secret_key_for_local_ai_jwt" # In production, use strong random key
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # LLM Settings
    LLM_MODEL_NAME: str = "llama3:8b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    
    # Embedding Model Settings
    EMBEDDING_MODEL_NAME: str = "paraphrase-multilingual-MiniLM-L12-v2"

    class Config:
        case_sensitive = True

settings = Settings()
