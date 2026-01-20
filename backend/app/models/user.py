from typing import Optional, Any
from datetime import datetime, timezone
from sqlmodel import Field, SQLModel, Column, JSON
from pydantic import field_serializer

def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True)  # Google/OAuth provider's user ID
    type: str = Field(default="google")  # "google", "email", etc.
    user_info: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSON))  # Raw provider data
    password: Optional[str] = Field(default=None)  # For email login (future)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime, _info):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return dt.isoformat().replace("+00:00", "Z")
