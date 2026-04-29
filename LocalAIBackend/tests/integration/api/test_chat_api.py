"""
Integration tests cho Chat API.
Mock: query_rag (LLM + ChromaDB), hybrid_retrieve.
Dùng SQLite in-memory từ conftest.py.
"""
import pytest
from unittest.mock import patch

from app.models.chat_model import ChatSession, Message


_MOCK_RAG_RESULT = {
    "answer": "Đây là câu trả lời test.",
    "citations": [],
    "suggestions": ["Câu hỏi 1?", "Câu hỏi 2?"],
}


# ---------------------------------------------------------------------------
# POST /api/chat/message
# ---------------------------------------------------------------------------

class TestChatMessage:
    @patch("app.api.routes.chat.query_rag", return_value=_MOCK_RAG_RESULT)
    def test_returns_reply_field(self, mock_rag, client):
        resp = client.post("/api/chat/message", json={"content": "Xin chào", "session_id": None})
        assert resp.status_code == 200
        body = resp.json()
        assert "reply" in body
        assert body["reply"] == "Đây là câu trả lời test."

    @patch("app.api.routes.chat.query_rag", return_value=_MOCK_RAG_RESULT)
    def test_returns_session_id(self, mock_rag, client):
        resp = client.post("/api/chat/message", json={"content": "Test", "session_id": None})
        assert resp.status_code == 200
        assert "session_id" in resp.json()
        assert isinstance(resp.json()["session_id"], int)

    @patch("app.api.routes.chat.query_rag", return_value=_MOCK_RAG_RESULT)
    def test_saves_messages_to_db(self, mock_rag, client, db, fake_user):
        resp = client.post("/api/chat/message", json={"content": "Lưu vào DB không?", "session_id": None})
        assert resp.status_code == 200

        session_id = resp.json()["session_id"]
        messages = db.query(Message).filter(Message.session_id == session_id).all()
        assert len(messages) == 2
        roles = {m.sender_type for m in messages}
        assert "user" in roles
        assert "assistant" in roles

    @patch("app.api.routes.chat.query_rag", return_value=_MOCK_RAG_RESULT)
    def test_reuses_existing_session(self, mock_rag, client, db, fake_user):
        # Tạo session đầu tiên
        session = ChatSession(user_id=fake_user.id, session_title="Test session")
        db.add(session)
        db.commit()
        db.refresh(session)

        resp = client.post(
            "/api/chat/message",
            json={"content": "Hỏi tiếp", "session_id": session.id},
        )
        assert resp.status_code == 200
        assert resp.json()["session_id"] == session.id

    @patch("app.api.routes.chat.query_rag", return_value=_MOCK_RAG_RESULT)
    def test_suggestions_returned(self, mock_rag, client):
        resp = client.post("/api/chat/message", json={"content": "Q?", "session_id": None})
        body = resp.json()
        assert "suggestions" in body
        assert isinstance(body["suggestions"], list)

    @patch("app.api.routes.chat.query_rag", return_value=_MOCK_RAG_RESULT)
    def test_with_selected_doc_ids(self, mock_rag, client):
        """selected_doc_ids được forward đúng vào query_rag."""
        resp = client.post(
            "/api/chat/message",
            json={"content": "Tài liệu nào?", "session_id": None, "selected_doc_ids": [1, 2, 3]},
        )
        assert resp.status_code == 200
        # Verify mock được gọi với allowed_doc_ids
        call_kwargs = mock_rag.call_args.kwargs
        assert call_kwargs.get("allowed_doc_ids") == [1, 2, 3]


# ---------------------------------------------------------------------------
# GET /api/chat/sessions/{session_id}/messages
# ---------------------------------------------------------------------------

class TestChatHistory:
    def _create_session_with_messages(self, db, user_id):
        session = ChatSession(user_id=user_id, session_title="History test")
        db.add(session)
        db.commit()
        db.refresh(session)

        db.add(Message(session_id=session.id, sender_type="user", content="Câu hỏi 1"))
        db.add(Message(session_id=session.id, sender_type="assistant", content="Trả lời 1"))
        db.commit()
        return session

    def test_get_session_messages(self, client, db, fake_user):
        session = self._create_session_with_messages(db, fake_user.id)
        resp = client.get(f"/api/chat/sessions/{session.id}/messages")
        assert resp.status_code == 200
        messages = resp.json().get("messages", resp.json())
        # Phải có ít nhất 2 messages
        assert len(messages) >= 2

    def test_nonexistent_session_returns_404(self, client):
        resp = client.get("/api/chat/sessions/99999/messages")
        assert resp.status_code == 404
