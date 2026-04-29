"""
Ingestion Service
=================
Luồng xử lý trọn gói từ file → vector store + SQLite:
1. Hash file để kiểm tra trùng lặp
2. Tạo Document record (PROCESSING)
3. Trích text theo định dạng (pdf/txt/docx/xlsx)
4. Chunk text → embeddings → ChromaDB
5. Cross-reference chunks vào SQLite document_pages
6. Cập nhật status SUCCESS / FAILED
"""

import os
import json
import uuid
from typing import Optional
from sqlalchemy.orm import Session

from app.crud.crud_document import create_document, update_document_status, create_document_page
from app.schemas.doc_schema import DocumentCreate, DocumentPageCreate
from app.services.document_parser import (
    generate_file_hash,
    extract_pages_from_pdf,
    chunk_text,
    chunk_text_with_pages,
)
from app.services.vector_store import add_documents_to_store
from app.services.hybrid_retriever import sync_page_to_fts


def _extract_text(file_path: str, file_type: str) -> str:
    """Trích text từ file theo định dạng (legacy – dùng cho non-PDF)."""
    ft = file_type.lower()

    if ft == "pdf":
        # Không dùng hàm này cho PDF nữa – dùng _extract_pages_with_metadata()
        from app.services.document_parser import extract_text_from_pdf
        return extract_text_from_pdf(file_path)

    if ft == "txt":
        for enc in ("utf-8", "utf-8-sig", "cp1258", "latin-1"):
            try:
                with open(file_path, "r", encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        raise ValueError("Không thể đọc file TXT: encoding không hỗ trợ")

    if ft in ("docx", "doc"):
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            raise ValueError("Cần cài: pip install python-docx")

    if ft in ("xlsx", "xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            lines = []
            for sheet in wb.worksheets:
                lines.append(f"[Sheet: {sheet.title}]")
                for row in sheet.iter_rows(values_only=True):
                    row_text = "\t".join(str(c) if c is not None else "" for c in row)
                    if row_text.strip():
                        lines.append(row_text)
            return "\n".join(lines)
        except ImportError:
            raise ValueError("Cần cài: pip install openpyxl")

    raise ValueError(f"Định dạng chưa hỗ trợ: {file_type}")


def ingest_file(
    db: Session,
    file_path: str,
    filename: str,
    file_type: str,
    category_id: int,
    uploaded_by: int,
    scope: str = "PERSONAL",
    session_id: Optional[int] = None,
) -> object:
    """
    Hàm chính: nhận file đã được lưu disk, trích xuất text, chunk,
    đẩy vào ChromaDB và SQLite. Trả về Document ORM object.
    """
    # 1. Đo lường cơ bản
    file_size = os.path.getsize(file_path)
    file_hash = generate_file_hash(file_path)

    # 2. Tạo Document record với status PROCESSING
    doc_in = DocumentCreate(
        title=filename,
        file_type=file_type,
        category_id=category_id,
        file_size_bytes=file_size,
        file_hash=file_hash,
        file_path=file_path,
        uploaded_by=uploaded_by,
    )
    db_doc = create_document(db, doc_in)
    update_document_status(db, db_doc, "PROCESSING")

    # Set scope/session_id ngay lập tức để frontend thấy file trong lúc chunk
    db_doc.document_scope = scope.upper()
    if scope.upper() == "PERSONAL" and session_id:
        db_doc.session_id = session_id
    db.commit()

    try:
        # ── Phân nhánh xử lý theo định dạng ──
        ft = file_type.lower()

        if ft == "pdf":
            # ★ PDF: dùng luồng mới – giữ page_number thật ★
            chunks_with_pages = _ingest_pdf(file_path, filename)
        else:
            # Non-PDF: trích text → chunk → gắn page_number = 1 (mặc định)
            text = _extract_text(file_path, file_type)
            if not text.strip():
                raise ValueError("File không có nội dung văn bản để xử lý")
            raw_chunks = chunk_text(text)
            chunks_with_pages = [
                {"text": c, "page_number": 1}
                for c in raw_chunks
            ]

        if not chunks_with_pages:
            raise ValueError("File không có nội dung văn bản để xử lý")

        # ── Chuẩn bị dữ liệu cho ChromaDB + SQLite ──
        documents_for_vector = []
        metadatas_for_vector = []
        chroma_ids_input = []
        total_tokens = 0

        for i, chunk_info in enumerate(chunks_with_pages):
            chunk_text_content = chunk_info["text"]
            page_number = chunk_info["page_number"]
            tokens = len(chunk_text_content) // 4
            total_tokens += tokens
            v_id = str(uuid.uuid4())

            metadata = {
                "source": filename,
                "document_id": db_doc.id,
                "chunk_index": i,
                "page_number": page_number,   # ★ SỐ TRANG THẬT ★
                "vector_id": v_id,
            }
            documents_for_vector.append(chunk_text_content)
            metadatas_for_vector.append(metadata)
            chroma_ids_input.append(v_id)

        # 5. Đẩy vào ChromaDB
        if documents_for_vector:
            chroma_ids = add_documents_to_store(
                texts=documents_for_vector,
                metadatas=metadatas_for_vector,
                ids=chroma_ids_input,
            )

            # 6. Lưu cross-reference vào SQLite document_pages
            for i, (chunk_info, v_id) in enumerate(zip(chunks_with_pages, chroma_ids)):
                tokens = len(chunk_info["text"]) // 4
                page_in = DocumentPageCreate(
                    document_id=db_doc.id,
                    chunk_index=i,
                    raw_content=chunk_info["text"],
                    token_count=tokens,
                    page_metadata=json.dumps(metadatas_for_vector[i]),
                    vector_id=v_id,
                )
                db_page = create_document_page(db, page_in)
                sync_page_to_fts(db, db_page.id, chunk_info["text"])

        # 7. Đánh dấu SUCCESS
        update_document_status(db, db_doc, "SUCCESS", total_tokens=total_tokens)
        print(f"[Ingestion OK] {filename} → {len(chunks_with_pages)} chunks, {total_tokens} tokens")

    except Exception as e:
        update_document_status(db, db_doc, "FAILED", error=str(e))
        print(f"[Ingestion FAIL] {filename}: {e}")
        raise

    return db_doc


def _ingest_pdf(file_path: str, filename: str) -> list[dict]:
    """
    Luồng PDF chuyên biệt: trích text từng trang → chunk theo trang → giữ page_number.
    """
    pages = extract_pages_from_pdf(file_path)
    if not pages:
        raise ValueError("PDF không có nội dung văn bản để xử lý")

    chunks_with_pages = chunk_text_with_pages(pages)
    print(f"[PDF Parse] {filename}: {len(pages)} trang → {len(chunks_with_pages)} chunks")
    return chunks_with_pages
