from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Union


class PerformanceLogCreate(BaseModel):
    match_date: datetime
    runs_scored: int
    wickets_taken: int = 0
    match_type: str = "friendly"
    opponent: Optional[str] = None
    performance_rating: float = 0.0
    notes: Optional[str] = None


class PerformanceLogUpdate(BaseModel):
    match_date: Optional[datetime] = None
    runs_scored: Optional[int] = None
    wickets_taken: Optional[int] = None
    match_type: Optional[str] = None
    opponent: Optional[str] = None
    performance_rating: Optional[float] = None
    notes: Optional[str] = None


class PerformanceLogResponse(BaseModel):
    id: int
    user_id: Union[int, str]
    match_date: datetime
    runs_scored: int
    wickets_taken: int
    match_type: str
    opponent: Optional[str]
    performance_rating: float
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
