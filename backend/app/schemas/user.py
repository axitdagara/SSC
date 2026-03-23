from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, Union


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: Union[int, str] = Field(..., description="User ID (can be integer or Firebase UID string)")
    name: str
    email: str
    role: str
    jersey_number: Optional[int] = None
    bio: Optional[str] = None
    runs: int
    matches: int
    wickets: int
    centuries: int
    half_centuries: int
    average_runs: float
    highest_score: int
    is_premium: bool
    premium_expiry: Optional[datetime] = None
    created_at: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    jersey_number: Optional[int] = None


class CareerStatsUpdate(BaseModel):
    runs: Optional[int] = None
    matches: Optional[int] = None
    wickets: Optional[int] = None
    centuries: Optional[int] = None
    half_centuries: Optional[int] = None
    highest_score: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class PremiumUpgradeRequest(BaseModel):
    plan_days: int = 30


class PremiumResponse(BaseModel):
    is_premium: bool
    premium_expiry: datetime
    message: str
