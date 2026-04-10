import os
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.core.config import settings

embed_model = None

def get_embedding_model():
    global embed_model
    if embed_model is None:
        # Load exactly on CPU
        embed_model = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL_NAME,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
    return embed_model

def get_vector_store():
    # Setup ChromaDB
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    embeddings = get_embedding_model()
    
    vector_store = Chroma(
        collection_name="local_ai_documents",
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )
    return vector_store

def add_documents_to_store(texts: list[str], metadatas: list[dict], ids: list[str] = None):
    vector_store = get_vector_store()
    returned_ids = vector_store.add_texts(texts=texts, metadatas=metadatas, ids=ids)
    return returned_ids

def search_documents(query: str, k: int = 3, filter_dict: dict = None):
    vector_store = get_vector_store()
    results = vector_store.similarity_search_with_relevance_scores(query, k=k, filter=filter_dict)
    return results
