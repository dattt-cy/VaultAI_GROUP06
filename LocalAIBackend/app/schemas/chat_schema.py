from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel

# Message Citation
class MessageCitationBase(BaseModel):
    document_page_id: int
    similarity_score: Optional[float] = None

class MessageCitationCreate(MessageCitationBase):
    pass

class MessageCitation(MessageCitationBase):
    id: int
    message_id: int
    
    # Ideally, we can include the subset of document metadata here for the UI
    document_title: Optional[str] = None
    chunk_index: Optional[int] = None
    raw_content: Optional[str] = None

    class Config:
        from_attributes = True

# Message
class MessageBase(BaseModel):
    sender_type: str
    content: str
    
class MessageCreate(MessageBase):
    session_id: int
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0

class Message(MessageBase):
    id: int
    session_id: int
    created_at: datetime
    citations: List[MessageCitation] = []

    class Config:
        from_attributes = True

# Chat Session
class ChatSessionBase(BaseModel):
    session_title: Optional[str] = "New Conversation"

class ChatSessionCreate(ChatSessionBase):
    user_id: int

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    messages: List[Message] = []

    class Config:
        from_attributes = True

# Chat Request from UI
class ChatRequest(BaseModel):
    session_id: Optional[int] = None
    content: str
    user_id: int = 1 # hardcode for now if missing auth
    stream: bool = False # whether to stream SSE
    selected_doc_ids: Optional[List[int]] = []
