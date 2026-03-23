from fastapi import APIRouter
from typing import List
from datetime import datetime, timezone
from google.api_core.exceptions import ResourceExhausted

from app.schemas import UserResponse
from app.utils.firestore_data import COLL, as_obj, list_docs, now_utc, update_doc, _parse_datetime, normalize_user
from app.utils.cache import get_cache

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _check_and_downgrade(player: dict) -> dict:
    expiry = player.get("premium_expiry")
    if player.get("is_premium") and expiry:
        # Parse expiry to timezone-aware datetime
        expiry_dt = _parse_datetime(expiry) if isinstance(expiry, str) else expiry
        
        # Ensure expiry_dt is timezone-aware
        if isinstance(expiry_dt, datetime) and expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
        
        # Check if premium has expired
        if expiry_dt and now_utc() >= expiry_dt:
            # Use _doc_id (actual Firestore document ID) if available, otherwise use id
            doc_id = player.get("_doc_id") or player.get("id")
            player = update_doc(COLL.users, doc_id, {"is_premium": False, "premium_expiry": None, "updated_at": now_utc()}) or player
    return player


@router.get("/overview")
async def get_dashboard_overview():
    cache = get_cache()
    
    def fetch_overview():
        players = list_docs(COLL.users, predicate=lambda row: row.get("is_active", True))
        total_players = len(players)
        premium_players = len([p for p in players if p.get("is_premium")])
        total_matches = sum(int(p.get("matches", 0)) for p in players)
        total_runs = sum(int(p.get("runs", 0)) for p in players)

        return {
            "total_players": total_players,
            "premium_players": premium_players,
            "total_matches": total_matches,
            "total_runs": total_runs,
        }
    
    try:
        return cache.get_or_fetch("dashboard_overview", fetch_overview, ttl_seconds=300)
    except ResourceExhausted:
        # Fall back to cached data if quota exceeded
        cached = cache.get("dashboard_overview")
        if cached:
            return cached
        raise


@router.get("/extended-overview")
async def get_extended_overview():
    cache = get_cache()
    
    def fetch_extended_overview():
        players = list_docs(COLL.users, predicate=lambda row: row.get("is_active", True) and row.get("role") == "player")

        total_players = len(players)
        premium_players = len([player for player in players if player.get("is_premium")])
        total_matches = sum(int(player.get("matches", 0)) for player in players)
        total_runs = sum(int(player.get("runs", 0)) for player in players)
        total_wickets = sum(int(player.get("wickets", 0)) for player in players)

        avg_runs_per_match = round(total_runs / total_matches, 2) if total_matches else 0.0
        premium_ratio = round((premium_players / total_players) * 100, 2) if total_players else 0.0

        top_performance = list_docs(COLL.performance_logs, sort_key="performance_rating", reverse=True, limit=1)
        top = top_performance[0] if top_performance else None

    return {
        "total_players": total_players,
        "premium_players": premium_players,
        "total_matches": total_matches,
        "total_runs": total_runs,
        "total_wickets": total_wickets,
        "avg_runs_per_match": avg_runs_per_match,
        "premium_ratio": premium_ratio,
        "top_performance": {
            "match_date": top.get("match_date") if top else None,
            "performance_rating": top.get("performance_rating", 0) if top else 0,
            "runs_scored": top.get("runs_scored", 0) if top else 0,
            "wickets_taken": top.get("wickets_taken", 0) if top else 0,
        },
        }
    
    try:
        return cache.get_or_fetch("dashboard_extended_overview", fetch_extended_overview, ttl_seconds=300)
    except ResourceExhausted:
        # Fall back to cached data if quota exceeded
        cached = cache.get("dashboard_extended_overview")
        if cached:
            return cached
        raise


@router.get("/featured-players", response_model=List[UserResponse])
async def get_featured_players():
    premium_players = list_docs(
        COLL.users,
        predicate=lambda row: row.get("is_premium") and row.get("is_active", True),
        sort_key="runs",
        reverse=True,
        limit=5,
    )
    return [normalize_user(_check_and_downgrade(row)) for row in premium_players]


@router.get("/recent-players", response_model=List[UserResponse])
async def get_recent_players():
    recent = list_docs(
        COLL.users,
        predicate=lambda row: row.get("is_active", True),
        sort_key="created_at",
        reverse=True,
        limit=10,
    )
    return [normalize_user(row) for row in recent]


@router.get("/top-stats")
async def get_top_stats():
    cache = get_cache()
    
    def fetch_top_stats():
        # Fetch active players once and compute top scorers and wicket takers from same list
        players = list_docs(COLL.users, predicate=lambda row: row.get("is_active", True))
        
        # Sort by runs and get top scorer
        top_scorers = sorted(players, key=lambda x: int(x.get("runs", 0)), reverse=True)
        top_scorer = top_scorers[0] if top_scorers else None
        
        # Sort by wickets and get top wicket taker
        top_wickets = sorted(players, key=lambda x: int(x.get("wickets", 0)), reverse=True)
        top_wicket_taker = top_wickets[0] if top_wickets else None

        return {
            "top_scorer": {
                "name": top_scorer.get("name") if top_scorer else None,
                "runs": top_scorer.get("runs", 0) if top_scorer else 0,
            },
            "top_wicket_taker": {
                "name": top_wicket_taker.get("name") if top_wicket_taker else None,
                "wickets": top_wicket_taker.get("wickets", 0) if top_wicket_taker else 0,
            },
        }
    
    try:
        return cache.get_or_fetch("dashboard_top_stats", fetch_top_stats, ttl_seconds=300)
    except ResourceExhausted:
        # Fall back to cached data if quota exceeded
        cached = cache.get("dashboard_top_stats")
        if cached:
            return cached
        raise


@router.get("/charts")
async def get_dashboard_chart_data():
    top_players = list_docs(COLL.users, predicate=lambda row: row.get("is_active", True), sort_key="runs", reverse=True, limit=6)
    recent_logs = list_docs(COLL.performance_logs, sort_key="match_date", reverse=False, limit=12)

    return {
        "top_players_runs": [{"name": player.get("name"), "runs": player.get("runs", 0)} for player in top_players],
        "recent_match_trend": [
            {
                "label": log.get("match_date").strftime("%d %b") if log.get("match_date") else "N/A",
                "runs": log.get("runs_scored", 0),
                "wickets": log.get("wickets_taken", 0),
                "rating": log.get("performance_rating", 0),
            }
            for log in recent_logs
        ],
    }


@router.get("/team-ai-insights")
async def get_team_ai_insights():
    recent_logs = list_docs(COLL.performance_logs, sort_key="match_date", reverse=True, limit=30)

    if not recent_logs:
        return {
            "headline": "No match data available yet",
            "team_form": "insufficient_data",
            "confidence_score": 0,
            "insights": ["Log team matches to unlock AI projections."],
        }

    avg_rating = sum(float(log.get("performance_rating", 0)) for log in recent_logs) / len(recent_logs)
    avg_runs = sum(float(log.get("runs_scored", 0)) for log in recent_logs) / len(recent_logs)
    avg_wickets = sum(float(log.get("wickets_taken", 0)) for log in recent_logs) / len(recent_logs)

    if avg_rating >= 7.5:
        team_form = "excellent"
    elif avg_rating >= 6.0:
        team_form = "stable"
    else:
        team_form = "rebuilding"

    confidence_score = int(min(100, max(0, (avg_rating * 10) + (avg_runs * 0.7) + (avg_wickets * 7))))

    insights = [
        f"Average match rating is {avg_rating:.1f}; team form is {team_form}.",
        f"Batting output is averaging {avg_runs:.1f} runs per logged innings.",
        f"Bowling impact is averaging {avg_wickets:.1f} wickets per logged innings.",
    ]

    if avg_runs < 35:
        insights.append("Batting powerplay phase needs focused improvement.")
    if avg_wickets < 1:
        insights.append("Bowling unit should optimize line/length in middle overs.")

    return {
        "headline": "AI team pulse generated",
        "team_form": team_form,
        "confidence_score": confidence_score,
        "insights": insights,
    }


@router.get("/funds-summary")
async def get_funds_summary():
    payments = list_docs(COLL.payments, predicate=lambda row: row.get("status") == "completed")
    transactions = list_docs(COLL.finance_transactions)

    total_collected = sum(float(row.get("amount", 0)) for row in payments)
    manual_credits = sum(
        float(row.get("amount", 0))
        for row in transactions
        if row.get("transaction_type") == "credit" and row.get("category") == "manual_credit"
    )
    guest_fund_spent = sum(
        float(row.get("amount", 0))
        for row in transactions
        if row.get("transaction_type") == "debit" and row.get("category") == "guest_fund"
    )
    all_debits = sum(
        float(row.get("amount", 0))
        for row in transactions
        if row.get("transaction_type") == "debit"
    )

    remaining_funds = round((total_collected + manual_credits) - all_debits, 2)

    return {
        "total_collected": round(total_collected, 2),
        "manual_credits": round(manual_credits, 2),
        "guest_fund_spent": round(guest_fund_spent, 2),
        "funds_remaining": remaining_funds,
    }
