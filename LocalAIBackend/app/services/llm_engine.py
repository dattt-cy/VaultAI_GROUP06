from langchain_ollama import OllamaLLM
from app.core.config import settings

def get_llm():
    # Setup connection to local Ollama instance
    llm = OllamaLLM(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.LLM_MODEL_NAME,
        temperature=0.7,
        top_p=0.9
    )
    return llm

def apply_pii_masking(text: str) -> str:
    """
    Dummy implementation for PII masking. 
    In production, use regex or a lightweight NER model to mask emails, phone numbers, CCCD, etc.
    """
    # Simple regex could be applied here
    import re
    # Mask simple phone numbers (10 digits)
    masked_text = re.sub(r'\b\d{10}\b', '[SỐ ĐIỆN THOẠI ĐÃ ẨN]', text)
    # Mask emails
    masked_text = re.sub(r'[\w\.-]+@[\w\.-]+', '[EMAIL ĐÃ ẨN]', masked_text)
    return masked_text

def check_hallucination(context: str, query: str) -> bool:
    """
    Anti-hallucination logic:
    Returns True if context seems completely irrelevant to the query.
    For MVP, we just check if context is empty.
    """
    if not context or context.strip() == "":
        return True
    return False
