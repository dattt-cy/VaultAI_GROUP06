"""
Mock heavy dependencies ở import level cho integration tests.
Phải chạy trước khi app code được import để tránh ModuleNotFoundError.
"""
import sys
from unittest.mock import MagicMock

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

import langchain_community.embeddings  # noqa: E402
langchain_community.embeddings.HuggingFaceEmbeddings = MagicMock
