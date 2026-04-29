"""
Integration tests cho Documents API.
Mock: _run_ingestion (background task), delete_documents_from_store (ChromaDB).
Dùng SQLite in-memory từ conftest.py.
"""
import io
import pytest
from unittest.mock import patch, MagicMock

from app.models.doc_model import Document, Category


def _seed_category(db):
    cat = db.query(Category).filter(Category.name == "Chung").first()
    if not cat:
        cat = Category(name="Chung", description="Default")
        db.add(cat)
        db.commit()
        db.refresh(cat)
    return cat


# ---------------------------------------------------------------------------
# POST /api/documents/upload
# ---------------------------------------------------------------------------

class TestUploadDocument:
    def _pdf_file(self):
        return ("test.pdf", io.BytesIO(b"%PDF-1.4 test content"), "application/pdf")

    @patch("app.api.routes.documents._run_ingestion")
    def test_upload_valid_pdf_returns_200(self, mock_ingest, client, db):
        _seed_category(db)
        name, content, mime = self._pdf_file()
        resp = client.post(
            "/api/documents/upload",
            files={"file": (name, content, mime)},
            data={"scope": "PERSONAL", "category_id": "1"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "filename" in body
        assert body["status"] == "PROCESSING"

    @patch("app.api.routes.documents._run_ingestion")
    def test_upload_invalid_extension_returns_400(self, mock_ingest, client, db):
        _seed_category(db)
        resp = client.post(
            "/api/documents/upload",
            files={"file": ("malware.exe", io.BytesIO(b"bad"), "application/octet-stream")},
            data={"scope": "PERSONAL", "category_id": "1"},
        )
        assert resp.status_code == 400
        assert "exe" in resp.json()["detail"].lower() or "hỗ trợ" in resp.json()["detail"]

    @patch("app.api.routes.documents._run_ingestion")
    def test_upload_company_scope_without_permission_returns_403(self, mock_ingest, client, db):
        """User thường không có quyền upload vào kho chung."""
        _seed_category(db)
        resp = client.post(
            "/api/documents/upload",
            files={"file": ("report.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
            data={"scope": "COMPANY", "category_id": "1"},
        )
        # fake_user role = "user" → không có CategoryPermission can_upload
        assert resp.status_code == 403

    @patch("app.api.routes.documents._run_ingestion")
    def test_upload_txt_file_accepted(self, mock_ingest, client, db):
        _seed_category(db)
        resp = client.post(
            "/api/documents/upload",
            files={"file": ("notes.txt", io.BytesIO(b"Hello world"), "text/plain")},
            data={"scope": "PERSONAL", "category_id": "1"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/documents/list
# ---------------------------------------------------------------------------

class TestListDocuments:
    def _insert_doc(self, db, user, scope="PERSONAL", title="doc.pdf"):
        cat = _seed_category(db)
        doc = Document(
            title=title,
            file_type="pdf",
            file_size_bytes=1024,
            file_hash="abc123",
            file_path=f"/tmp/{title}",
            category_id=cat.id,
            uploaded_by=user.id,
            document_scope=scope,
            ingestion_status="SUCCESS",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    def test_list_personal_returns_own_docs(self, client, db, fake_user):
        self._insert_doc(db, fake_user, scope="PERSONAL", title="my_doc.pdf")
        resp = client.get("/api/documents/list?scope=PERSONAL")
        assert resp.status_code == 200
        docs = resp.json()["documents"]
        assert any(d["title"] == "my_doc.pdf" for d in docs)

    def test_list_personal_excludes_others_docs(self, client, db, fake_user, fake_admin):
        # Admin uploads một doc PERSONAL
        self._insert_doc(db, fake_admin, scope="PERSONAL", title="admin_private.pdf")
        resp = client.get("/api/documents/list?scope=PERSONAL")
        assert resp.status_code == 200
        docs = resp.json()["documents"]
        assert not any(d["title"] == "admin_private.pdf" for d in docs)

    def test_list_returns_correct_fields(self, client, db, fake_user):
        self._insert_doc(db, fake_user, scope="PERSONAL", title="fields_test.pdf")
        resp = client.get("/api/documents/list?scope=PERSONAL")
        assert resp.status_code == 200
        doc = next((d for d in resp.json()["documents"] if d["title"] == "fields_test.pdf"), None)
        assert doc is not None
        assert "id" in doc
        assert "ingestion_status" in doc
        assert "file_type" in doc


# ---------------------------------------------------------------------------
# DELETE /api/documents/{doc_id}
# ---------------------------------------------------------------------------

class TestDeleteDocument:
    def _insert_doc(self, db, user):
        cat = _seed_category(db)
        doc = Document(
            title="to_delete.pdf",
            file_type="pdf",
            file_size_bytes=512,
            file_hash="del123",
            file_path="/tmp/to_delete.pdf",
            category_id=cat.id,
            uploaded_by=user.id,
            document_scope="PERSONAL",
            ingestion_status="SUCCESS",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    @patch("app.api.routes.documents.delete_documents_from_store")
    def test_delete_own_doc_returns_200(self, mock_chroma_delete, client, db, fake_user):
        doc = self._insert_doc(db, fake_user)
        resp = client.delete(f"/api/documents/{doc.id}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @patch("app.api.routes.documents.delete_documents_from_store")
    def test_delete_calls_chroma_cleanup(self, mock_chroma_delete, client, db, fake_user):
        """Đảm bảo ChromaDB cleanup được gọi khi xóa document."""
        doc = self._insert_doc(db, fake_user)
        client.delete(f"/api/documents/{doc.id}")
        mock_chroma_delete.assert_called_once()

    @patch("app.api.routes.documents.delete_documents_from_store")
    def test_delete_other_users_doc_returns_403(self, mock_chroma_delete, client, db, fake_user, fake_admin):
        """User không thể xóa doc của người khác."""
        # Admin upload doc
        cat = _seed_category(db)
        admin_doc = Document(
            title="admin_doc.pdf",
            file_type="pdf",
            file_size_bytes=256,
            file_hash="adm456",
            file_path="/tmp/admin_doc.pdf",
            category_id=cat.id,
            uploaded_by=fake_admin.id,
            document_scope="PERSONAL",
            ingestion_status="SUCCESS",
        )
        db.add(admin_doc)
        db.commit()
        db.refresh(admin_doc)

        # fake_user (non-admin) cố xóa doc của admin
        resp = client.delete(f"/api/documents/{admin_doc.id}")
        assert resp.status_code == 403

    @patch("app.api.routes.documents.delete_documents_from_store")
    def test_delete_nonexistent_doc_returns_404(self, mock_chroma_delete, client, db):
        resp = client.delete("/api/documents/99999")
        assert resp.status_code == 404
