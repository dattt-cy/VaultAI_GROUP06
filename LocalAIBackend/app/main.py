from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Database setup — model imports register tables with SQLAlchemy metadata
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import user_model, doc_model, chat_model, sys_model  # noqa: F401

# Routers
from app.api.routes import documents, chat, admin, auth

Base.metadata.create_all(bind=engine)

# Migrate existing tables: add columns not yet present
def _run_migrations():
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        msg_cols = {c["name"] for c in inspector.get_columns("messages")}
        if "citations_json" not in msg_cols:
            conn.execute(text("ALTER TABLE messages ADD COLUMN citations_json TEXT"))
            conn.commit()

_run_migrations()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.on_event("startup")
def seed_initial_data():
    from app.models.user_model import Role, User
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(name="admin", access_level=10, description="Quản trị viên")
            db.add(admin_role)
            db.flush()

        user_role = db.query(Role).filter(Role.name == "user").first()
        if not user_role:
            user_role = Role(name="user", access_level=1, description="Người dùng")
            db.add(user_role)
            db.flush()

        db.commit()
        db.refresh(admin_role)

        if not db.query(User).first():
            default_admin = User(
                username="admin",
                full_name="Administrator",
                password_hash=get_password_hash("admin123"),
                role_id=admin_role.id,
                is_active=True,
            )
            db.add(default_admin)
            db.commit()
            print("[Seed] Tài khoản mặc định: username=admin  password=admin123")
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Welcome to Local AI Backend API"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
