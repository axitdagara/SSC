from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import get_current_user
from app.schemas import (
    BallEventCreate,
    MatchCreate,
    MatchDetailResponse,
    MatchPlayerView,
    MatchResponse,
    MatchScoreboardResponse,
    MatchStartRequest,
    MatchTeamSetupRequest,
)
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, list_docs, now_utc, update_doc, _parse_datetime
from app.utils.logger import log_action

router = APIRouter(prefix="/matches", tags=["Matches"])


def ensure_match_editor(match_obj: dict, current_user):
    if current_user.role == "admin":
        return
    if match_obj.get("created_by_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only match creator can update this match")


def ensure_premium_creator(user: dict):
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
            user = update_doc(COLL.users, user["id"], {"is_premium": False, "premium_expiry": None, "updated_at": now_utc()}) or user

    if not user.get("is_premium"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only premium players can create matches")


def get_team_totals(match_id: int):
    events = list_docs(COLL.ball_events, predicate=lambda row: row.get("match_id") == match_id)

    team_a_runs = 0
    team_b_runs = 0
    team_a_wickets = 0
    team_b_wickets = 0

    for event in events:
        total = int(event.get("runs_off_bat", 0)) + int(event.get("extras", 0))
        if event.get("batting_team") == "A":
            team_a_runs += total
            if event.get("is_wicket"):
                team_a_wickets += 1
        elif event.get("batting_team") == "B":
            team_b_runs += total
            if event.get("is_wicket"):
                team_b_wickets += 1

    return team_a_runs, team_b_runs, team_a_wickets, team_b_wickets


def get_innings_teams(match_id: int, default_team: str):
    first_innings_event = first_doc(
        COLL.ball_events,
        predicate=lambda row: row.get("match_id") == match_id and row.get("innings") == 1,
        sort_key="created_at",
        reverse=False,
    )

    first_batting_team = first_innings_event.get("batting_team") if first_innings_event else (default_team or "A")
    second_batting_team = "B" if first_batting_team == "A" else "A"
    return first_batting_team, second_batting_team


def get_batting_side_player_count(match_id: int, team: str):
    return len(list_docs(COLL.match_players, predicate=lambda row: row.get("match_id") == match_id and row.get("team") == team))


def build_scoreboard(match_obj: dict, innings: int):
    batting_team = match_obj.get("batting_team") or "A"
    events = list_docs(
        COLL.ball_events,
        predicate=lambda row: row.get("match_id") == match_obj.get("id") and row.get("innings") == innings,
        sort_key="created_at",
        reverse=False,
    )

    # Get all balls from all innings for match history
    all_events = list_docs(
        COLL.ball_events,
        predicate=lambda row: row.get("match_id") == match_obj.get("id"),
        sort_key="created_at",
        reverse=False,
    )

    total_runs = sum(int(event.get("runs_off_bat", 0)) + int(event.get("extras", 0)) for event in events)
    wickets = sum(1 for event in events if event.get("is_wicket"))
    legal_balls = sum(1 for event in events if event.get("extra_type") not in {"wide", "no_ball"})

    completed_overs = legal_balls // 6
    balls_in_current_over = legal_balls % 6
    overs_display = f"{completed_overs}.{balls_in_current_over}"

    recent_balls = []
    over_map = {}

    for event in events[-18:]:
        ball_text = f"{event.get('over_number')}.{event.get('ball_number')} "
        if event.get("is_wicket"):
            ball_text += "W"
        elif event.get("extra_type"):
            ball_text += f"{int(event.get('runs_off_bat', 0)) + int(event.get('extras', 0))} ({event.get('extra_type')})"
        else:
            ball_text += str(event.get("runs_off_bat", 0))
        recent_balls.append(ball_text)

    for event in events:
        if event.get("is_wicket"):
            result = "W"
        elif event.get("extra_type"):
            result = f"{int(event.get('runs_off_bat', 0)) + int(event.get('extras', 0))} ({event.get('extra_type')})"
        else:
            result = str(event.get("runs_off_bat", 0))

        over_no = int(event.get("over_number", 1))
        over_map.setdefault(over_no, []).append(f"{event.get('ball_number')}:{result}")

    if over_map:
        current_over_number = max(over_map.keys())
        current_over_balls = over_map.get(current_over_number, [])
        past_overs = [
            f"Over {over_no}: " + ", ".join(over_map[over_no])
            for over_no in sorted(over_map.keys())
            if over_no != current_over_number
        ]
    else:
        current_over_number = 1
        current_over_balls = []
        past_overs = []

    team_a_runs, team_b_runs, team_a_wickets, team_b_wickets = get_team_totals(match_obj.get("id"))
    first_team, second_team = get_innings_teams(match_obj.get("id"), match_obj.get("batting_team") or "A")

    winner_team = None
    result_text = None

    if match_obj.get("status") == "completed":
        if team_a_runs == team_b_runs:
            result_text = "Match tied"
        else:
            winner_code = "A" if team_a_runs > team_b_runs else "B"
            winner_team = match_obj.get("team_a_name") if winner_code == "A" else match_obj.get("team_b_name")

            if winner_code == second_team:
                winner_player_count = get_batting_side_player_count(match_obj.get("id"), winner_code)
                winner_wickets = team_a_wickets if winner_code == "A" else team_b_wickets
                wickets_in_hand = max(0, (winner_player_count - 1) - winner_wickets)
                result_text = f"{winner_team} won by {wickets_in_hand} wicket{'s' if wickets_in_hand != 1 else ''}"
            else:
                margin = abs(team_a_runs - team_b_runs)
                result_text = f"{winner_team} won by {margin} run{'s' if margin != 1 else ''}"

    return MatchScoreboardResponse(
        match_id=match_obj.get("id"),
        innings=innings,
        match_status=match_obj.get("status"),
        current_innings=match_obj.get("current_innings", 1),
        batting_team=batting_team,
        total_runs=total_runs,
        wickets=wickets,
        legal_balls=legal_balls,
        overs_display=overs_display,
        recent_balls=recent_balls,
        current_over_number=current_over_number,
        current_over_balls=current_over_balls,
        past_overs=past_overs,
        team_a_runs=team_a_runs,
        team_b_runs=team_b_runs,
        winner_team=winner_team,
        result_text=result_text,
        all_balls=[
            {
                "id": event.get("id"),
                "innings": event.get("innings"),
                "over_number": event.get("over_number"),
                "ball_number": event.get("ball_number"),
                "batting_team": event.get("batting_team"),
                "runs_off_bat": event.get("runs_off_bat", 0),
                "extras": event.get("extras", 0),
                "extra_type": event.get("extra_type"),
                "is_wicket": event.get("is_wicket", False),
                "wicket_type": event.get("wicket_type"),
                "commentary": event.get("commentary"),
                "created_at": event.get("created_at"),
            }
            for event in all_events
        ],
    )


def get_next_delivery_position(match_id: int, innings: int):
    events = list_docs(
        COLL.ball_events,
        predicate=lambda row: row.get("match_id") == match_id and row.get("innings") == innings,
        sort_key="created_at",
    )
    legal_balls = len([e for e in events if e.get("extra_type") not in {"wide", "no_ball"}])
    over_number = (legal_balls // 6) + 1
    ball_number = (legal_balls % 6) + 1
    return over_number, ball_number


@router.post("", response_model=MatchResponse)
async def create_match(payload: MatchCreate, current_user=Depends(get_current_user)):
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ensure_premium_creator(user)

    if payload.overs_per_innings <= 0:
        raise HTTPException(status_code=400, detail="Overs must be greater than zero")

    match_obj = create_doc(
        COLL.matches,
        {
            "title": payload.title.strip(),
            "created_by_id": current_user.id,
            "team_a_name": payload.team_a_name.strip(),
            "team_b_name": payload.team_b_name.strip(),
            "overs_per_innings": payload.overs_per_innings,
            "status": "setup",
            "current_innings": 1,
            "batting_team": None,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        },
    )

    log_action("Created live match", user_id=current_user.id, details=match_obj.get("title"))
    return as_obj(match_obj)


@router.get("", response_model=list[MatchResponse])
async def list_matches(current_user=Depends(get_current_user)):
    _ = current_user
    matches = list_docs(COLL.matches, sort_key="created_at", reverse=True, limit=50)
    return [as_obj(row) for row in matches]


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match(match_id: int, current_user=Depends(get_current_user)):
    _ = current_user
    match_obj = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    rows = list_docs(COLL.match_players, predicate=lambda row: row.get("match_id") == match_id)

    team_a = []
    team_b = []
    for row in rows:
        player = first_doc(COLL.users, predicate=lambda u: u.get("id") == row.get("user_id"))
        name = (player or {}).get("name", "Unknown")
        view = MatchPlayerView(user_id=row.get("user_id"), team=row.get("team"), name=name)
        if row.get("team") == "A":
            team_a.append(view)
        else:
            team_b.append(view)

    return MatchDetailResponse(match=as_obj(match_obj), team_a_players=team_a, team_b_players=team_b)


@router.post("/{match_id}/teams")
async def setup_match_teams(match_id: int, payload: MatchTeamSetupRequest, current_user=Depends(get_current_user)):
    match_obj = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    if set(payload.team_a_player_ids).intersection(set(payload.team_b_player_ids)):
        raise HTTPException(status_code=400, detail="Same player cannot exist in both teams")

    all_player_ids = list(set(payload.team_a_player_ids + payload.team_b_player_ids))
    if not all_player_ids:
        raise HTTPException(status_code=400, detail="Select players for both teams")

    # Check for valid players - must match either 'id', 'uid' field, or document ID and be active
    def is_valid_player(row):
        if not row.get("is_active", True):
            return False
        # Check document id (row.get("id") in Firestore context), id field, uid field
        player_id = row.get("id") or row.get("uid")
        return player_id in all_player_ids
    
    users = list_docs(COLL.users, predicate=is_valid_player)
    if len(users) != len(all_player_ids):
        # Debug: log which players were not found
        found_ids = set((u.get("id") or u.get("uid")) for u in users)
        missing_ids = set(all_player_ids) - found_ids
        print(f"Missing players: {missing_ids}, Found: {found_ids}, All requested: {all_player_ids}")
        raise HTTPException(status_code=400, detail=f"One or more selected players are invalid (not found: {missing_ids})")

    existing = list_docs(COLL.match_players, predicate=lambda row: row.get("match_id") == match_id)
    for row in existing:
        from app.utils.firestore_data import delete_doc

        delete_doc(COLL.match_players, row.get("id"))

    for player_id in payload.team_a_player_ids:
        create_doc(COLL.match_players, {"match_id": match_id, "user_id": player_id, "team": "A", "is_captain": False})

    for player_id in payload.team_b_player_ids:
        create_doc(COLL.match_players, {"match_id": match_id, "user_id": player_id, "team": "B", "is_captain": False})

    log_action("Updated match teams", user_id=current_user.id, details=f"match_id={match_id}")
    return {"message": "Teams updated"}


@router.post("/{match_id}/start", response_model=MatchResponse)
async def start_match(match_id: int, payload: MatchStartRequest, current_user=Depends(get_current_user)):
    match_obj = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    batting_team = payload.batting_team.upper().strip()
    if batting_team not in {"A", "B"}:
        raise HTTPException(status_code=400, detail="batting_team must be A or B")

    team_count = len(list_docs(COLL.match_players, predicate=lambda row: row.get("match_id") == match_id))
    if team_count == 0:
        raise HTTPException(status_code=400, detail="Please set teams first")

    match_obj = update_doc(
        COLL.matches,
        match_id,
        {"status": "live", "current_innings": 1, "batting_team": batting_team, "updated_at": now_utc()},
    )

    log_action("Started match", user_id=current_user.id, details=f"match_id={match_id}")
    return as_obj(match_obj)


@router.post("/{match_id}/ball")
async def record_ball_event(match_id: int, payload: BallEventCreate, current_user=Depends(get_current_user)):
    match_obj = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    if match_obj.get("status") != "live":
        raise HTTPException(status_code=400, detail="Match is not live")

    if payload.runs_off_bat < 0 or payload.extras < 0:
        raise HTTPException(status_code=400, detail="Runs and extras cannot be negative")

    innings_in_use = match_obj.get("current_innings") or payload.innings
    batting_team_in_use = (match_obj.get("batting_team") or payload.batting_team or "").upper().strip()
    if batting_team_in_use not in {"A", "B"}:
        raise HTTPException(status_code=400, detail="batting_team must be A or B")

    auto_over_number, auto_ball_number = get_next_delivery_position(match_id, innings_in_use)
    legal_ball = payload.extra_type not in {"wide", "no_ball"}

    current_events = list_docs(
        COLL.ball_events,
        predicate=lambda row: row.get("match_id") == match_id and row.get("innings") == innings_in_use,
    )
    current_legal = len([e for e in current_events if e.get("extra_type") not in {"wide", "no_ball"}])

    if legal_ball and current_legal >= (int(match_obj.get("overs_per_innings", 20)) * 6):
        raise HTTPException(status_code=400, detail="Innings overs limit reached")

    create_doc(
        COLL.ball_events,
        {
            "match_id": match_id,
            "innings": innings_in_use,
            "over_number": auto_over_number,
            "ball_number": auto_ball_number,
            "batting_team": batting_team_in_use,
            "striker_id": payload.striker_id,
            "bowler_id": payload.bowler_id,
            "runs_off_bat": payload.runs_off_bat,
            "extras": payload.extras,
            "extra_type": payload.extra_type,
            "is_wicket": payload.is_wicket,
            "wicket_type": payload.wicket_type,
            "commentary": payload.commentary,
            "created_by_id": current_user.id,
            "created_at": now_utc(),
        },
    )

    refreshed_match = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    scoreboard = build_scoreboard(refreshed_match, innings_in_use)

    innings_over = False
    match_completed = False

    team_player_count = get_batting_side_player_count(match_id, batting_team_in_use)
    # All out when all players are dismissed (not team_player_count - 1)
    all_out_limit = team_player_count
    if team_player_count > 0 and scoreboard.wickets >= all_out_limit:
        innings_over = True
        if innings_in_use == 1:
            update_doc(
                COLL.matches,
                match_id,
                {
                    "current_innings": 2,
                    "batting_team": "B" if batting_team_in_use == "A" else "A",
                    "updated_at": now_utc(),
                },
            )
        else:
            update_doc(COLL.matches, match_id, {"status": "completed", "updated_at": now_utc()})
            match_completed = True

    refreshed_match = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)

    if not match_completed and innings_in_use == 2:
        first_team, second_team = get_innings_teams(match_id, batting_team_in_use)
        team_a_runs, team_b_runs, _, _ = get_team_totals(match_id)
        first_score = team_a_runs if first_team == "A" else team_b_runs
        second_score = team_a_runs if second_team == "A" else team_b_runs

        if second_score > first_score:
            update_doc(COLL.matches, match_id, {"status": "completed", "updated_at": now_utc()})
            refreshed_match = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
            match_completed = True
            innings_over = True

    next_innings = refreshed_match.get("current_innings") or innings_in_use
    next_over_number, next_ball_number = get_next_delivery_position(match_id, next_innings)

    return {
        "message": "Ball recorded",
        "innings_over": innings_over,
        "match_completed": match_completed,
        "match_status": refreshed_match.get("status"),
        "recorded_ball": {
            "innings": innings_in_use,
            "over_number": auto_over_number,
            "ball_number": auto_ball_number,
        },
        "next_ball": {
            "innings": next_innings,
            "over_number": next_over_number,
            "ball_number": next_ball_number,
            "batting_team": refreshed_match.get("batting_team"),
        },
        "scoreboard": scoreboard,
    }


@router.get("/{match_id}/scoreboard", response_model=MatchScoreboardResponse)
async def get_match_scoreboard(match_id: int, innings: int = 1, current_user=Depends(get_current_user)):
    _ = current_user
    match_obj = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    return build_scoreboard(match_obj, innings)


@router.post("/{match_id}/complete", response_model=MatchResponse)
async def complete_match(match_id: int, current_user=Depends(get_current_user)):
    match_obj = first_doc(COLL.matches, predicate=lambda row: row.get("id") == match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    match_obj = update_doc(COLL.matches, match_id, {"status": "completed", "updated_at": now_utc()})

    log_action("Completed match", user_id=current_user.id, details=f"match_id={match_id}")
    return as_obj(match_obj)
