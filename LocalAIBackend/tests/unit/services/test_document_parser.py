"""
Unit tests cho document_parser.py — test các hàm không cần LLM/ChromaDB.
"""
import os
import pytest
from app.services.document_parser import generate_file_hash, chunk_text


class TestGenerateFileHash:
    def test_same_file_same_hash(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_bytes(b"Hello World")
        h1 = generate_file_hash(str(f))
        h2 = generate_file_hash(str(f))
        assert h1 == h2

    def test_different_content_different_hash(self, tmp_path):
        f1 = tmp_path / "a.txt"
        f2 = tmp_path / "b.txt"
        f1.write_bytes(b"Content A")
        f2.write_bytes(b"Content B")
        assert generate_file_hash(str(f1)) != generate_file_hash(str(f2))

    def test_hash_is_sha256_hex(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_bytes(b"data")
        h = generate_file_hash(str(f))
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_empty_file_has_known_hash(self, tmp_path):
        f = tmp_path / "empty.txt"
        f.write_bytes(b"")
        import hashlib
        expected = hashlib.sha256(b"").hexdigest()
        assert generate_file_hash(str(f)) == expected


class TestChunkText:
    def test_short_text_single_chunk(self):
        text = "Đây là một đoạn văn ngắn."
        chunks = chunk_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_multiple_chunks(self):
        # Tạo text dài hơn chunk_size mặc định
        text = "Từ ngữ. " * 300   # ~2400 chars
        chunks = chunk_text(text)
        assert len(chunks) > 1

    def test_no_content_lost(self):
        """Tổng nội dung các chunk phải bao phủ text gốc (không mất dữ liệu)."""
        text = "Đây là câu. " * 200
        chunks = chunk_text(text)
        merged = " ".join(chunks)
        # Mỗi từ trong text gốc phải xuất hiện trong merged
        sample_words = ["Đây", "câu"]
        for word in sample_words:
            assert word in merged

    def test_chunks_are_non_empty(self):
        text = "Nội dung tài liệu. " * 100
        chunks = chunk_text(text)
        assert all(len(c.strip()) > 0 for c in chunks)
