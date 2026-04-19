from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    first_name: str
    last_name: str


class UserUpdate(BaseModel):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    display_name: str
    avatar_url: str | None = None
    email_verified: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
