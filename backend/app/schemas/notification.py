from pydantic import BaseModel
from datetime import datetime
from typing import Union


class NotificationResponse(BaseModel):
    id: int
    user_id: Union[int, str]
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
