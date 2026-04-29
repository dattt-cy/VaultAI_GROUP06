"""
Mock các heavy dependencies ở import level cho unit tests.
Giúp test chạy mà không cần cài chromadb, pdfplumber, easyocr, sentence-transformers.
"""
import sys
from unittest.mock import MagicMock

# Danh sách modules cần mock trước khi app code được import
_HEAVY_MODULES = [
    "chromadb",
    "langchain_chroma",
    "langchain_chroma.vectorstores",
    "pdfplumber",
    "easyocr",
    "sentence_transformers",
    "langchain_community",
    "langchain_community.embeddings",
    "langchain_community.embeddings.huggingface",
    "langchain_huggingface",
    "langchain_ollama",
    "langchain_ollama.chat_models",
    "fitz",  # PyMuPDF
]

for mod in _HEAVY_MODULES:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

# Mock cụ thể HuggingFaceEmbeddings để tránh lỗi attribute
from unittest.mock import patch
import langchain_community.embeddings
langchain_community.embeddings.HuggingFaceEmbeddings = MagicMock
