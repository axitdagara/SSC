from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Union

from app.middleware.auth import get_current_user
from app.schemas import PerformanceLogCreate, PerformanceLogUpdate, PerformanceLogResponse
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, list_docs, now_utc, update_doc, delete_doc
from app.utils.logger import log_action

router = APIRouter(prefix="/performance", tags=["Performance"])


def recalculate_user_career_stats(user_id: int) -> None:
    logs = list_docs(COLL.performance_logs, predicate=lambda row: row.get("user_id") == user_id)

    matches = len(logs)
    runs = sum(int(log.get("runs_scored", 0)) for log in logs)
    wickets = sum(int(log.get("wickets_taken", 0)) for log in logs)
    centuries = sum(1 for log in logs if int(log.get("runs_scored", 0)) >= 100)
    half_centuries = sum(1 for log in logs if 50 <= int(log.get("runs_scored", 0)) < 100)
    highest_score = max([int(log.get("runs_scored", 0)) for log in logs], default=0)
    average_runs = round(runs / matches, 2) if matches else 0.0

    update_doc(
        COLL.users,
        user_id,
        {
            "matches": matches,
            "runs": runs,
            "wickets": wickets,
            "centuries": centuries,
            "half_centuries": half_centuries,
            "highest_score": highest_score,
            "average_runs": average_runs,
            "updated_at": now_utc(),
        },
    )


def build_ai_insights(logs: List[dict]) -> dict:
    if not logs:
        return {
            "headline": "No recent match data",
            "form": "insufficient_data",
            "consistency_score": 0,
            "strengths": [],
            "focus_areas": ["Log at least 3 matches to unlock AI insights"],
            "recommendations": [
                "Track match stats after each game.",
                "Add batting and bowling notes for better insights.",
            ],
        }

    recent = logs[:5]
    avg_runs = sum(float(item.get("runs_scored", 0)) for item in recent) / len(recent)
    avg_wickets = sum(float(item.get("wickets_taken", 0)) for item in recent) / len(recent)
    avg_rating = sum(float(item.get("performance_rating", 0)) for item in recent) / len(recent)

    first_runs = float(recent[-1].get("runs_scored", 0))
    latest_runs = float(recent[0].get("runs_scored", 0))
    run_trend = latest_runs - first_runs

    if avg_rating >= 8:
        form = "hot"
    elif avg_rating >= 6:
        form = "steady"
    else:
        form = "needs_work"

    strengths = []
    focus_areas = []

    if avg_runs >= 45:
        strengths.append("Strong batting output in recent matches")
    else:
        focus_areas.append("Improve shot selection in first 20 balls")

    if avg_wickets >= 1.2:
        strengths.append("Consistent wicket-taking impact")
    else:
        focus_areas.append("Work on death-over bowling plans")

    if run_trend > 0:
        strengths.append("Positive scoring trend over last few matches")
    elif run_trend < 0:
        focus_areas.append("Recent scoring is dropping - revisit batting routine")

    consistency_score = int(min(100, max(0, (avg_rating * 10) + (avg_runs * 0.8) + (avg_wickets * 8))))

    recommendations = [
        "Schedule one focused nets session before the next fixture.",
        "Set a single-match target and review it after every innings.",
        "Track opponent-specific plans in the notes section.",
    ]

    return {
        "headline": "AI performance snapshot ready",
        "form": form,
        "consistency_score": consistency_score,
        "recent_average_runs": round(avg_runs, 2),
        "recent_average_wickets": round(avg_wickets, 2),
        "recent_average_rating": round(avg_rating, 2),
        "strengths": strengths,
        "focus_areas": focus_areas,
        "recommendations": recommendations,
    }


@router.post("", response_model=PerformanceLogResponse)
async def log_performance(
    performance: PerformanceLogCreate,
    current_user=Depends(get_current_user),
):
    if performance.runs_scored < 0 or performance.wickets_taken < 0:
        raise HTTPException(status_code=400, detail="Runs and wickets cannot be negative")

    perf_log = create_doc(
        COLL.performance_logs,
        {
            "user_id": current_user.id,
            "match_date": performance.match_date,
            "runs_scored": performance.runs_scored,
            "wickets_taken": performance.wickets_taken,
            "match_type": performance.match_type,
            "opponent": performance.opponent,
            "performance_rating": performance.performance_rating,
            "notes": performance.notes,
            "created_at": now_utc(),
        },
    )

    recalculate_user_career_stats(current_user.id)
    log_action("Performance logged", user_id=current_user.id, details=f"{performance.runs_scored} runs")
    return as_obj(perf_log)


@router.get("/my-logs", response_model=List[PerformanceLogResponse])
async def get_my_performance_logs(
    current_user=Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
):
    logs = list_docs(
        COLL.performance_logs,
        predicate=lambda row: row.get("user_id") == current_user.id,
        sort_key="match_date",
        reverse=True,
        offset=skip,
        limit=limit,
    )
    return [as_obj(row) for row in logs]


@router.get("/match-history")
async def get_my_match_history(
    current_user=Depends(get_current_user),
    skip: int = 0,
    limit: int = 30,
):
    logs = list_docs(
        COLL.performance_logs,
        predicate=lambda row: row.get("user_id") == current_user.id,
        sort_key="match_date",
        reverse=True,
        offset=skip,
        limit=limit,
    )

    total_runs = sum(int(log.get("runs_scored", 0)) for log in logs)
    total_wickets = sum(int(log.get("wickets_taken", 0)) for log in logs)
    average_rating = round(
        sum(float(log.get("performance_rating", 0)) for log in logs) / len(logs), 2
    ) if logs else 0.0

    best_match = None
    if logs:
        top = max(logs, key=lambda item: (int(item.get("runs_scored", 0)) + (int(item.get("wickets_taken", 0)) * 20)))
        best_match = {
            "id": top.get("id"),
            "match_date": top.get("match_date"),
            "opponent": top.get("opponent"),
            "runs_scored": top.get("runs_scored"),
            "wickets_taken": top.get("wickets_taken"),
            "performance_rating": top.get("performance_rating"),
        }

    return {
        "summary": {
            "matches_logged": len(logs),
            "total_runs": total_runs,
            "total_wickets": total_wickets,
            "average_rating": average_rating,
            "best_match": best_match,
        },
        "logs": [as_obj(row) for row in logs],
    }


@router.put("/{log_id}", response_model=PerformanceLogResponse)
async def update_performance_log(
    log_id: int,
    payload: PerformanceLogUpdate,
    current_user=Depends(get_current_user),
):
    perf_log = first_doc(
        COLL.performance_logs,
        predicate=lambda row: row.get("id") == log_id and row.get("user_id") == current_user.id,
    )

    if not perf_log:
        raise HTTPException(status_code=404, detail="Performance log not found")

    updates = payload.model_dump(exclude_unset=True)

    if "runs_scored" in updates and updates["runs_scored"] < 0:
        raise HTTPException(status_code=400, detail="Runs cannot be negative")
    if "wickets_taken" in updates and updates["wickets_taken"] < 0:
        raise HTTPException(status_code=400, detail="Wickets cannot be negative")

    perf_log = update_doc(COLL.performance_logs, log_id, updates)
    recalculate_user_career_stats(current_user.id)

    log_action("Performance log updated", user_id=current_user.id, details=f"log_id={log_id}")
    return as_obj(perf_log)


@router.delete("/{log_id}")
async def delete_performance_log(
    log_id: int,
    current_user=Depends(get_current_user),
):
    perf_log = first_doc(
        COLL.performance_logs,
        predicate=lambda row: row.get("id") == log_id and row.get("user_id") == current_user.id,
    )

    if not perf_log:
        raise HTTPException(status_code=404, detail="Performance log not found")

    delete_doc(COLL.performance_logs, log_id)
    recalculate_user_career_stats(current_user.id)

    log_action("Performance log deleted", user_id=current_user.id, details=f"log_id={log_id}")
    return {"message": "Performance log deleted"}


@router.get("/player/{player_id}", response_model=List[PerformanceLogResponse])
async def get_player_performance_logs(
    player_id: Union[int, str],
    skip: int = 0,
    limit: int = 20,
):
    player = first_doc(COLL.users, predicate=lambda row: row.get("id") == player_id)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    logs = list_docs(
        COLL.performance_logs,
        predicate=lambda row: row.get("user_id") == player_id,
        sort_key="match_date",
        reverse=True,
        offset=skip,
        limit=limit,
    )

    return [as_obj(row) for row in logs]


@router.get("/stats/{player_id}")
async def get_player_stats(player_id: Union[int, str]):
    player = first_doc(COLL.users, predicate=lambda row: row.get("id") == player_id)

    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    return {
        "id": player.get("id"),
        "name": player.get("name"),
        "runs": player.get("runs", 0),
        "matches": player.get("matches", 0),
        "wickets": player.get("wickets", 0),
        "centuries": player.get("centuries", 0),
        "half_centuries": player.get("half_centuries", 0),
        "average_runs": player.get("average_runs", 0.0),
        "highest_score": player.get("highest_score", 0),
    }


@router.get("/ai-insights/{player_id}")
async def get_player_ai_insights(player_id: Union[int, str]):
    player = first_doc(COLL.users, predicate=lambda row: row.get("id") == player_id)

    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    logs = list_docs(
        COLL.performance_logs,
        predicate=lambda row: row.get("user_id") == player_id,
        sort_key="match_date",
        reverse=True,
        limit=10,
    )

    return {
        "player_id": player.get("id"),
        "player_name": player.get("name"),
        "insights": build_ai_insights(logs),
    }
