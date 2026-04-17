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
    LLM_MODEL_NAME: str = "qwen2.5:7b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LLM_TEMPERATURE: float = 0.3       # Thấp hơn → ít hallucinate, bám sát context hơn
    LLM_NUM_PREDICT: int = 2048        # Cho phép câu trả lời dài và chi tiết hơn
    LLM_NUM_CTX: int = 8192            # 7 chunks × ~800 chars ≈ 2000 tokens + prompt 1500 = cần ít nhất 6000
    
    # Embedding Model Settings
    EMBEDDING_MODEL_NAME: str = "paraphrase-multilingual-MiniLM-L12-v2"
    
    # Reranker Model Settings (Cross-Encoder)
    # Defaulting to ms-marco-MiniLM-L-6-v2 for speed. 
    # For better Vietnamese support, consider: "BAAI/bge-reranker-v2-m3" (Note: ~2.2GB download)
    RERANKER_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    class Config:
        case_sensitive = True

settings = Settings()
