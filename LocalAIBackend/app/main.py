import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Database setup
from app.db.base import Base
from app.db.session import engine
from app.models import user_model, doc_model, chat_model, sys_model

# Routers
from app.api.routes import documents, chat, admin

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(admin.router, prefix="/api/admin", tags=["🛠 Admin"])

@app.get("/")
def root():
    return {"message": "Welcome to Local AI Backend API"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

