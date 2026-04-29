"""
Shared fixtures cho toàn bộ test suite.
- SQLite in-memory DB (scope=session → tạo 1 lần, dùng xuyên suốt)
- Fake user để bypass JWT auth
- FastAPI TestClient với dependency overrides
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.api.dependencies import get_db, get_current_user

# Import models để register với metadata
from app.models import user_model, doc_model, chat_model, sys_model  # noqa: F401

TEST_DB_URL = "sqlite://"


@pytest.fixture(scope="session")
def engine():
    # StaticPool ensures all sessions share a single in-memory connection
    e = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=e)
    yield e
    Base.metadata.drop_all(bind=e)


@pytest.fixture(scope="session")
def SessionFactory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db(SessionFactory):
    session = SessionFactory()
    yield session
    session.rollback()
    session.close()


def _seed_role_and_user(db):
    """Tạo role + user test nếu chưa có."""
    from app.models.user_model import Role, User

    role = db.query(Role).filter(Role.name == "user").first()
    if not role:
        role = Role(name="user", access_level=1, description="Test role")
        db.add(role)
        db.flush()

    user = db.query(User).filter(User.username == "testuser").first()
    if not user:
        user = User(
            username="testuser",
            full_name="Test User",
            password_hash="hashed",
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.flush()

    db.commit()
    db.refresh(user)
    return user


def _seed_admin_role_and_user(db):
    """Tạo admin role + user nếu chưa có."""
    from app.models.user_model import Role, User

    role = db.query(Role).filter(Role.name == "admin").first()
    if not role:
        role = Role(name="admin", access_level=10, description="Admin role")
        db.add(role)
        db.flush()

    user = db.query(User).filter(User.username == "adminuser").first()
    if not user:
        user = User(
            username="adminuser",
            full_name="Admin User",
            password_hash="hashed",
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.flush()

    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def fake_user(db):
    return _seed_role_and_user(db)


@pytest.fixture
def fake_admin(db):
    return _seed_admin_role_and_user(db)


@pytest.fixture
def client(db, fake_user):
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: fake_user

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(db, fake_admin):
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: fake_admin

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()
