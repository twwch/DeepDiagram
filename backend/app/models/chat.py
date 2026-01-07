from typing import Optional, List, Any
from datetime import datetime, timezone
from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from pydantic import field_serializer

def utc_now():
    # Return naive UTC datetime for database compatibility
    return datetime.now(timezone.utc).replace(tzinfo=None)

class ChatSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="New Chat")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    
    messages: List["ChatMessage"] = Relationship(back_populates="session")

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime, _info):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return dt.isoformat().replace("+00:00", "Z")

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[int] = Field(default=None, foreign_key="chatsession.id")
    parent_id: Optional[int] = Field(default=None, foreign_key="chatmessage.id")
    role: str # "user" or "assistant"
    content: str
    images: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    steps: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))
    agent: Optional[str] = Field(default=None)
    turn_index: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    
    session: Optional[ChatSession] = Relationship(back_populates="messages")

    @field_serializer("created_at")
    def serialize_dt(self, dt: datetime, _info):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return dt.isoformat().replace("+00:00", "Z")
