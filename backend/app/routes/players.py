from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Union
from app.schemas import UserResponse, UserUpdate, CareerStatsUpdate
from app.middleware.auth import get_current_user
from app.utils.firestore_data import COLL, as_obj, first_doc, list_docs, now_utc, update_doc, _parse_datetime, normalize_user
from app.utils.logger import log_action

router = APIRouter(prefix="/players", tags=["Players"])


def _check_and_downgrade_premium(user: dict) -> dict:
    from datetime import datetime, timezone
    
    expiry = user.get("premium_expiry")
    if user.get("is_premium") and expiry:
        # Parse expiry to timezone-aware datetime
        expiry_dt = _parse_datetime(expiry) if isinstance(expiry, str) else expiry
        
        # Ensure expiry_dt is timezone-aware
        if isinstance(expiry_dt, datetime) and expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
        
        # Check if premium has expired
        if expiry_dt and now_utc() >= expiry_dt:
            # Use _doc_id (actual Firestore document ID) if available, otherwise use id
            doc_id = user.get("_doc_id") or user.get("id")
            user = update_doc(
                COLL.users,
                doc_id,
                {"is_premium": False, "premium_expiry": None, "updated_at": now_utc()},
            ) or user
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_player(current_user=Depends(get_current_user)):
    """Get current logged-in player's profile"""
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")
    user = _check_and_downgrade_premium(user)
    log_action("Viewed own profile", user_id=user["id"])
    return normalize_user(user)


@router.put("/me", response_model=UserResponse)
async def update_current_player(
    user_update: UserUpdate,
    current_user=Depends(get_current_user),
):
    """Update current player's profile"""
    
    patch = {"updated_at": now_utc()}
    if user_update.name:
        patch["name"] = user_update.name
    if user_update.bio is not None:
        patch["bio"] = user_update.bio
    if user_update.jersey_number is not None:
        patch["jersey_number"] = user_update.jersey_number

    user = update_doc(COLL.users, current_user.id, patch)
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")

    log_action("Updated profile", user_id=user["id"])
    return normalize_user(user)


@router.put("/me/career-stats", response_model=UserResponse)
async def update_career_stats(
    stats_update: CareerStatsUpdate,
    current_user=Depends(get_current_user),
):
    """Update current player's career statistics"""

    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")

    patch = {"updated_at": now_utc()}

    if stats_update.runs is not None:
        if stats_update.runs < 0:
            raise HTTPException(status_code=400, detail="Runs cannot be negative")
        patch["runs"] = stats_update.runs

    if stats_update.matches is not None:
        if stats_update.matches < 0:
            raise HTTPException(status_code=400, detail="Matches cannot be negative")
        patch["matches"] = stats_update.matches

    if stats_update.wickets is not None:
        if stats_update.wickets < 0:
            raise HTTPException(status_code=400, detail="Wickets cannot be negative")
        patch["wickets"] = stats_update.wickets

    if stats_update.centuries is not None:
        if stats_update.centuries < 0:
            raise HTTPException(status_code=400, detail="Centuries cannot be negative")
        patch["centuries"] = stats_update.centuries

    if stats_update.half_centuries is not None:
        if stats_update.half_centuries < 0:
            raise HTTPException(status_code=400, detail="Half-centuries cannot be negative")
        patch["half_centuries"] = stats_update.half_centuries

    if stats_update.highest_score is not None:
        if stats_update.highest_score < 0:
            raise HTTPException(status_code=400, detail="Highest score cannot be negative")
        patch["highest_score"] = stats_update.highest_score

    runs = patch.get("runs", user.get("runs", 0))
    matches = patch.get("matches", user.get("matches", 0))
    if matches > 0:
        patch["average_runs"] = round(runs / matches, 2)
    else:
        patch["average_runs"] = 0.0

    user = update_doc(COLL.users, current_user.id, patch)
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")

    log_action("Updated career stats", user_id=user["id"])
    return normalize_user(user)


@router.get("", response_model=List[UserResponse])
async def list_all_players(skip: int = 0, limit: int = 50):
    """Get list of all active players"""

    players = list_docs(
        COLL.users,
        predicate=lambda row: row.get("is_active", True),
        sort_key="created_at",
        reverse=True,
        offset=skip,
        limit=limit,
    )
    return [normalize_user(_check_and_downgrade_premium(player)) for player in players]


@router.get("/premium", response_model=List[UserResponse])
async def get_premium_players():
    """Get list of premium players"""

    premium_players = list_docs(
        COLL.users,
        predicate=lambda row: row.get("is_active", True) and row.get("is_premium", False),
        sort_key="runs",
        reverse=True,
    )
    return [normalize_user(_check_and_downgrade_premium(player)) for player in premium_players]


@router.get("/leaderboard/top-performers", response_model=List[UserResponse])
async def get_top_performers(limit: int = 10):
    """Get top performers by runs"""

    top_players = list_docs(
        COLL.users,
        predicate=lambda row: row.get("is_active", True),
        sort_key="runs",
        reverse=True,
        limit=limit,
    )
    return [normalize_user(row) for row in top_players]


@router.get("/leaderboard/by-wickets", response_model=List[UserResponse])
async def get_top_wicket_takers(limit: int = 10):
    """Get top wicket takers"""

    top_wicket_takers = list_docs(
        COLL.users,
        predicate=lambda row: row.get("is_active", True),
        sort_key="wickets",
        reverse=True,
        limit=limit,
    )
    return [normalize_user(row) for row in top_wicket_takers]


@router.get("/{player_id}", response_model=UserResponse)
async def get_player(player_id: Union[int, str]):
    """Get player profile by ID"""
    
    player = first_doc(COLL.users, predicate=lambda row: row.get("id") == player_id)
    
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player not found"
        )
    
    player = _check_and_downgrade_premium(player)
    return normalize_user(player)
