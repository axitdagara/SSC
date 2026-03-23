from pydantic import BaseModel
from datetime import datetime
from typing import Union


class AdminChatCreate(BaseModel):
    message: str


class AdminChatResponse(BaseModel):
    id: int
    user_id: Union[int, str]
    sender_role: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
