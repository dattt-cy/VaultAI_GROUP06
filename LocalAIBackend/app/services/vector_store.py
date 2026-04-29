import os
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.core.config import settings

# Singleton cache — tránh tạo lại Chroma/Embedding object mỗi request
_embed_model = None
_vector_store = None


def get_embedding_model() -> HuggingFaceEmbeddings:
    global _embed_model
    if _embed_model is None:
        _embed_model = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL_NAME,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
    return _embed_model


def get_vector_store() -> Chroma:
    """
    Trả về singleton Chroma vector store.
    Tạo mới chỉ 1 lần khi server start — giảm overhead mỗi request.
    """
    global _vector_store
    if _vector_store is None:
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        embeddings = get_embedding_model()
        _vector_store = Chroma(
            collection_name="local_ai_documents",
            embedding_function=embeddings,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )
    return _vector_store


def add_documents_to_store(texts: list[str], metadatas: list[dict], ids: list[str] = None):
    vector_store = get_vector_store()
    returned_ids = vector_store.add_texts(texts=texts, metadatas=metadatas, ids=ids)
    return returned_ids


def delete_documents_from_store(vector_ids: list[str]) -> None:
    """Xóa các vector khỏi ChromaDB theo danh sách vector_id."""
    if not vector_ids:
        return
    vector_store = get_vector_store()
    try:
        vector_store.delete(ids=vector_ids)
    except Exception as e:
        print(f"[ChromaDB] Lỗi xóa vectors: {e}")


def search_documents(query: str, k: int = 3, filter_dict: dict = None):
    vector_store = get_vector_store()
    results = vector_store.similarity_search_with_relevance_scores(query, k=k, filter=filter_dict)
    return results
