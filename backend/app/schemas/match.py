from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class MatchCreate(BaseModel):
    title: str
    team_a_name: str
    team_b_name: str
    overs_per_innings: int = 20


class MatchResponse(BaseModel):
    id: int
    title: str
    created_by_id: int
    team_a_name: str
    team_b_name: str
    overs_per_innings: int
    status: str
    current_innings: int
    batting_team: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MatchTeamSetupRequest(BaseModel):
    team_a_player_ids: List[int]
    team_b_player_ids: List[int]


class MatchPlayerView(BaseModel):
    user_id: int
    name: str
    team: str


class MatchDetailResponse(BaseModel):
    match: MatchResponse
    team_a_players: List[MatchPlayerView]
    team_b_players: List[MatchPlayerView]


class MatchStartRequest(BaseModel):
    batting_team: str  # A or B


class BallEventCreate(BaseModel):
    innings: int = 1
    over_number: int
    ball_number: int
    batting_team: str  # A or B
    striker_id: Optional[int] = None
    bowler_id: Optional[int] = None
    runs_off_bat: int = 0
    extras: int = 0
    extra_type: Optional[str] = None
    is_wicket: bool = False
    wicket_type: Optional[str] = None
    commentary: Optional[str] = None


class BallEventResponse(BaseModel):
    id: int
    innings: int
    over_number: int
    ball_number: int
    batting_team: str
    runs_off_bat: int
    extras: int
    extra_type: Optional[str]
    is_wicket: bool
    wicket_type: Optional[str]
    commentary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MatchScoreboardResponse(BaseModel):
    match_id: int
    innings: int
    match_status: str
    current_innings: int
    batting_team: str
    total_runs: int
    wickets: int
    legal_balls: int
    overs_display: str
    recent_balls: List[str]
    current_over_number: int
    current_over_balls: List[str]
    past_overs: List[str]
    team_a_runs: int
    team_b_runs: int
    winner_team: Optional[str] = None
    result_text: Optional[str] = None
