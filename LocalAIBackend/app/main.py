from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.core.config import settings

# Database setup — model imports register tables with SQLAlchemy metadata
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import user_model, doc_model, chat_model, sys_model  # noqa: F401

# Routers
from app.api.routes import documents, chat, admin, auth
from app.api.routes import admin_ollama, admin_rag_config, admin_backup, admin_security
from app.api.routes import admin_eval
from app.api.routes import admin_system, admin_users, admin_permissions, admin_monitor
from app.api.routes import admin_actions
from app.api.dependencies import require_min_level

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

        fb_cols = {c["name"] for c in inspector.get_columns("feedbacks")}
        if "resolved" not in fb_cols:
            conn.execute(text("ALTER TABLE feedbacks ADD COLUMN resolved BOOLEAN DEFAULT FALSE"))
            conn.commit()

_run_migrations()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_uploads_dir = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(os.path.join(_uploads_dir, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"], dependencies=[Depends(require_min_level(5))])
app.include_router(admin_ollama.router, prefix="/api/admin", tags=["Admin - Ollama"])
app.include_router(admin_rag_config.router, prefix="/api/admin", tags=["Admin - RAG Config"])
app.include_router(admin_backup.router, prefix="/api/admin", tags=["Admin - Backup"])
app.include_router(admin_security.router, prefix="/api/admin", tags=["Admin - Security"])
app.include_router(admin_eval.router, prefix="/api/admin", tags=["Admin - Eval"])
app.include_router(admin_system.router, prefix="/api/admin", tags=["Admin - System"], dependencies=[Depends(require_min_level(5))])
app.include_router(admin_users.router, prefix="/api/admin", tags=["Admin - Users"], dependencies=[Depends(require_min_level(5))])
app.include_router(admin_permissions.router, prefix="/api/admin", tags=["Admin - Permissions"], dependencies=[Depends(require_min_level(5))])
app.include_router(admin_monitor.router, prefix="/api/admin", tags=["Admin - Monitor"], dependencies=[Depends(require_min_level(5))])
app.include_router(admin_actions.router, prefix="/api/admin", tags=["Admin - Actions"])


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

        # Seed LLM config nếu chưa có
        from app.models.sys_model import LlmConfig, SystemPrompt
        if not db.query(LlmConfig).first():
            default_llm = LlmConfig(
                model_name=settings.LLM_MODEL_NAME,
                temperature=settings.LLM_TEMPERATURE,
                context_window_limit=settings.LLM_NUM_CTX,
                max_new_tokens=settings.LLM_NUM_PREDICT,
                is_active=True,
            )
            db.add(default_llm)
            db.commit()
            print(f"[Seed] LLM config mặc định: model={settings.LLM_MODEL_NAME}")

        # Seed System Prompt nếu chưa có
        if not db.query(SystemPrompt).first():
            default_prompt = SystemPrompt(
                version_name="v1.0 - Mặc định",
                description="System prompt mặc định cho trợ lý AI nội bộ",
                prompt_content=(
                    "Bạn là trợ lý AI nội bộ của tổ chức. "
                    "Hãy trả lời dựa trên tài liệu được cung cấp, trung thực và rõ ràng. "
                    "Nếu không tìm thấy thông tin trong tài liệu, hãy nói thẳng là không có dữ liệu liên quan. "
                    "Trả lời bằng tiếng Việt trừ khi người dùng hỏi bằng ngôn ngữ khác."
                ),
                is_active=True,
            )
            db.add(default_prompt)
            db.commit()
            print("[Seed] System prompt mặc định đã được tạo")
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Welcome to Local AI Backend API"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
