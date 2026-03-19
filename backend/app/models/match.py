from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    team_a_name = Column(String(80), nullable=False)
    team_b_name = Column(String(80), nullable=False)

    overs_per_innings = Column(Integer, default=20)
    status = Column(String(30), default="setup")  # setup, live, completed
    current_innings = Column(Integer, default=1)
    batting_team = Column(String(1), nullable=True)  # A or B

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MatchPlayer(Base):
    __tablename__ = "match_players"
    __table_args__ = (UniqueConstraint("match_id", "user_id", name="uq_match_player"),)

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    team = Column(String(1), nullable=False)  # A or B
    is_captain = Column(Boolean, default=False)


class BallEvent(Base):
    __tablename__ = "ball_events"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)

    innings = Column(Integer, default=1)
    over_number = Column(Integer, nullable=False)
    ball_number = Column(Integer, nullable=False)

    batting_team = Column(String(1), nullable=False)  # A or B
    striker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    bowler_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    runs_off_bat = Column(Integer, default=0)
    extras = Column(Integer, default=0)
    extra_type = Column(String(30), nullable=True)  # wide, no_ball, bye, leg_bye

    is_wicket = Column(Boolean, default=False)
    wicket_type = Column(String(50), nullable=True)

    commentary = Column(String(300), nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
