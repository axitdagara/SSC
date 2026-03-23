from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Union


class PaymentRequest(BaseModel):
    amount: float
    payment_method: str = "razorpay"


class PaymentResponse(BaseModel):
    id: int
    user_id: Union[int, str]
    amount: float
    status: str
    transaction_id: str
    created_at: datetime

    class Config:
        from_attributes = True
