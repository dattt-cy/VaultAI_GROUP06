import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Local AI Backend"
    API_V1_STR: str = "/api/v1"
    
    # Database
    SQLALCHEMY_DATABASE_URI: str = "mysql+pymysql://root:1234567890aS@localhost:3306/localai?charset=utf8mb4"
    
    # Vector DB
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    
    # Security
    SECRET_KEY: str = "this_is_a_very_secret_key_for_local_ai_jwt" # In production, use strong random key
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # LLM Settings
    LLM_MODEL_NAME: str = "qwen2.5:7b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LLM_TEMPERATURE: float = 0.1       # Thấp → qwen2.5:7b bám sát tài liệu, ít bịa hơn
    LLM_NUM_PREDICT: int = 4096        # Tăng nhẹ từ 2048 — đủ cho câu trả lời chi tiết mà không OOM
    LLM_NUM_CTX: int = 8192            # Giữ 8192: qwen2.5:7b + KV cache vừa khít 4GB VRAM RTX 3050
    LLM_NUM_GPU: int = -1              # Offload tối đa layers lên GPU, Ollama tự cân bằng khi hết VRAM
    LLM_NUM_BATCH: int = 128           # Nhỏ vừa phải cho 4GB VRAM, tránh OOM trong batch decode

    # Thinking / Reasoning Settings
    THINKING_ENABLED: bool = False     # Tắt thinking để giảm latency từ 3-5 phút xuống ~20-35 giây
    THINKING_MODEL_NAME: str = "qwen3:8b"  # Model hỗ trợ native thinking qua Ollama think=true
    
    # Embedding Model Settings
    EMBEDDING_MODEL_NAME: str = "./models/bge-m3"
    
    # Reranker Model Settings (Cross-Encoder)
    # mmarco-mMiniLMv2-L12-H384-v1: ~400MB, trained on mMARCO (multilingual incl. Vietnamese)
    # Alternative higher quality: "BAAI/bge-reranker-v2-m3" (~2.2GB)
    RERANKER_MODEL_NAME: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

    # Chunking Settings — Parent-Child strategy
    PARENT_CHUNK_SIZE: int = 800    # Đưa vào LLM context (ngữ cảnh đầy đủ)
    PARENT_CHUNK_OVERLAP: int = 100
    CHILD_CHUNK_SIZE: int = 300     # Dùng để embed + retrieval (tìm kiếm chính xác)
    CHILD_CHUNK_OVERLAP: int = 50

    class Config:
        case_sensitive = True

settings = Settings()
