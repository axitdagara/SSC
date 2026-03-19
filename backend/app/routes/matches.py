from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import BallEvent, Match, MatchPlayer, User
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
from app.utils.logger import log_action
from app.utils.premium import check_and_downgrade_premium

router = APIRouter(prefix="/matches", tags=["Matches"])


def ensure_match_editor(match_obj: Match, current_user: User):
    if current_user.role == "admin":
        return
    if match_obj.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only match creator can update this match",
        )


def ensure_premium_creator(db: Session, user: User):
    check_and_downgrade_premium(db, user)
    db.refresh(user)
    if not user.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only premium players can create matches",
        )


def get_team_totals(db: Session, match_id: int):
    events = db.query(BallEvent).filter(BallEvent.match_id == match_id).all()

    team_a_runs = 0
    team_b_runs = 0
    team_a_wickets = 0
    team_b_wickets = 0

    for event in events:
        total = event.runs_off_bat + event.extras
        if event.batting_team == "A":
            team_a_runs += total
            if event.is_wicket:
                team_a_wickets += 1
        elif event.batting_team == "B":
            team_b_runs += total
            if event.is_wicket:
                team_b_wickets += 1

    return team_a_runs, team_b_runs, team_a_wickets, team_b_wickets


def get_innings_teams(db: Session, match_id: int, default_team: str):
    first_innings_event = (
        db.query(BallEvent)
        .filter(BallEvent.match_id == match_id, BallEvent.innings == 1)
        .order_by(BallEvent.created_at.asc())
        .first()
    )

    first_batting_team = first_innings_event.batting_team if first_innings_event else (default_team or "A")
    second_batting_team = "B" if first_batting_team == "A" else "A"
    return first_batting_team, second_batting_team


def build_scoreboard(db: Session, match_obj: Match, innings: int):
    batting_team = match_obj.batting_team or "A"
    events = (
        db.query(BallEvent)
        .filter(BallEvent.match_id == match_obj.id, BallEvent.innings == innings)
        .order_by(BallEvent.created_at.asc())
        .all()
    )

    total_runs = sum(event.runs_off_bat + event.extras for event in events)
    wickets = sum(1 for event in events if event.is_wicket)
    legal_balls = sum(1 for event in events if event.extra_type not in {"wide", "no_ball"})

    completed_overs = legal_balls // 6
    balls_in_current_over = legal_balls % 6
    overs_display = f"{completed_overs}.{balls_in_current_over}"

    recent_balls = []
    over_map = {}

    for event in events[-18:]:
        ball_text = f"{event.over_number}.{event.ball_number} "
        if event.is_wicket:
            ball_text += "W"
        elif event.extra_type:
            ball_text += f"{event.runs_off_bat + event.extras} ({event.extra_type})"
        else:
            ball_text += str(event.runs_off_bat)
        recent_balls.append(ball_text)

    for event in events:
        if event.is_wicket:
            result = "W"
        elif event.extra_type:
            result = f"{event.runs_off_bat + event.extras} ({event.extra_type})"
        else:
            result = str(event.runs_off_bat)

        over_map.setdefault(event.over_number, []).append(f"{event.ball_number}:{result}")

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

    team_a_runs, team_b_runs, team_a_wickets, team_b_wickets = get_team_totals(db, match_obj.id)
    first_team, second_team = get_innings_teams(db, match_obj.id, match_obj.batting_team or "A")

    winner_team = None
    result_text = None

    if match_obj.status == "completed":
        if team_a_runs == team_b_runs:
            result_text = "Match tied"
        else:
            winner_code = "A" if team_a_runs > team_b_runs else "B"
            winner_team = match_obj.team_a_name if winner_code == "A" else match_obj.team_b_name

            if winner_code == second_team:
                winner_player_count = get_batting_side_player_count(db, match_obj.id, winner_code)
                winner_wickets = team_a_wickets if winner_code == "A" else team_b_wickets
                wickets_in_hand = max(0, (winner_player_count - 1) - winner_wickets)
                result_text = f"{winner_team} won by {wickets_in_hand} wicket{'s' if wickets_in_hand != 1 else ''}"
            else:
                margin = abs(team_a_runs - team_b_runs)
                result_text = f"{winner_team} won by {margin} run{'s' if margin != 1 else ''}"

    return MatchScoreboardResponse(
        match_id=match_obj.id,
        innings=innings,
        match_status=match_obj.status,
        current_innings=match_obj.current_innings,
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
    )


def get_next_delivery_position(db: Session, match_id: int, innings: int):
    legal_balls = (
        db.query(BallEvent)
        .filter(BallEvent.match_id == match_id, BallEvent.innings == innings)
        .filter(BallEvent.extra_type.is_(None) | (~BallEvent.extra_type.in_(["wide", "no_ball"])))
        .count()
    )

    over_number = (legal_balls // 6) + 1
    ball_number = (legal_balls % 6) + 1
    return over_number, ball_number


def get_batting_side_player_count(db: Session, match_id: int, team: str):
    return (
        db.query(MatchPlayer)
        .filter(MatchPlayer.match_id == match_id, MatchPlayer.team == team)
        .count()
    )


@router.post("", response_model=MatchResponse)
async def create_match(
    payload: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_premium_creator(db, current_user)

    if payload.overs_per_innings <= 0:
        raise HTTPException(status_code=400, detail="Overs must be greater than zero")

    match_obj = Match(
        title=payload.title.strip(),
        created_by_id=current_user.id,
        team_a_name=payload.team_a_name.strip(),
        team_b_name=payload.team_b_name.strip(),
        overs_per_innings=payload.overs_per_innings,
    )
    db.add(match_obj)
    db.commit()
    db.refresh(match_obj)

    log_action("Created live match", user_id=current_user.id, details=match_obj.title)
    return match_obj


@router.get("", response_model=list[MatchResponse])
async def list_matches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    matches = db.query(Match).order_by(Match.created_at.desc()).limit(50).all()
    return matches


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    match_obj = db.query(Match).filter(Match.id == match_id).first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    rows = (
        db.query(MatchPlayer.user_id, MatchPlayer.team, User.name)
        .join(User, User.id == MatchPlayer.user_id)
        .filter(MatchPlayer.match_id == match_id)
        .all()
    )

    team_a = []
    team_b = []
    for user_id, team, name in rows:
        view = MatchPlayerView(user_id=user_id, team=team, name=name)
        if team == "A":
            team_a.append(view)
        else:
            team_b.append(view)

    return MatchDetailResponse(
        match=match_obj,
        team_a_players=team_a,
        team_b_players=team_b,
    )


@router.post("/{match_id}/teams")
async def setup_match_teams(
    match_id: int,
    payload: MatchTeamSetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match_obj = db.query(Match).filter(Match.id == match_id).first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    if set(payload.team_a_player_ids).intersection(set(payload.team_b_player_ids)):
        raise HTTPException(status_code=400, detail="Same player cannot exist in both teams")

    all_player_ids = list(set(payload.team_a_player_ids + payload.team_b_player_ids))
    if not all_player_ids:
        raise HTTPException(status_code=400, detail="Select players for both teams")

    valid_count = (
        db.query(func.count(User.id))
        .filter(User.id.in_(all_player_ids), User.is_active == True)
        .scalar()
    )
    if valid_count != len(all_player_ids):
        raise HTTPException(status_code=400, detail="One or more selected players are invalid")

    db.query(MatchPlayer).filter(MatchPlayer.match_id == match_id).delete()

    for player_id in payload.team_a_player_ids:
        db.add(MatchPlayer(match_id=match_id, user_id=player_id, team="A"))

    for player_id in payload.team_b_player_ids:
        db.add(MatchPlayer(match_id=match_id, user_id=player_id, team="B"))

    db.commit()
    log_action("Updated match teams", user_id=current_user.id, details=f"match_id={match_id}")

    return {"message": "Teams updated"}


@router.post("/{match_id}/start", response_model=MatchResponse)
async def start_match(
    match_id: int,
    payload: MatchStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match_obj = db.query(Match).filter(Match.id == match_id).first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    batting_team = payload.batting_team.upper().strip()
    if batting_team not in {"A", "B"}:
        raise HTTPException(status_code=400, detail="batting_team must be A or B")

    team_count = db.query(MatchPlayer).filter(MatchPlayer.match_id == match_id).count()
    if team_count == 0:
        raise HTTPException(status_code=400, detail="Please set teams first")

    match_obj.status = "live"
    match_obj.current_innings = 1
    match_obj.batting_team = batting_team
    db.commit()
    db.refresh(match_obj)

    log_action("Started match", user_id=current_user.id, details=f"match_id={match_id}")
    return match_obj


@router.post("/{match_id}/ball")
async def record_ball_event(
    match_id: int,
    payload: BallEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match_obj = db.query(Match).filter(Match.id == match_id).first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    if match_obj.status != "live":
        raise HTTPException(status_code=400, detail="Match is not live")

    if payload.runs_off_bat < 0 or payload.extras < 0:
        raise HTTPException(status_code=400, detail="Runs and extras cannot be negative")

    innings_in_use = match_obj.current_innings or payload.innings
    batting_team_in_use = (match_obj.batting_team or payload.batting_team or "").upper().strip()
    if batting_team_in_use not in {"A", "B"}:
        raise HTTPException(status_code=400, detail="batting_team must be A or B")

    auto_over_number, auto_ball_number = get_next_delivery_position(db, match_id, innings_in_use)
    legal_ball = payload.extra_type not in {"wide", "no_ball"}

    # Enforce innings over limit for legal balls only
    current_legal = (
        db.query(BallEvent)
        .filter(BallEvent.match_id == match_id, BallEvent.innings == innings_in_use)
        .filter(BallEvent.extra_type.is_(None) | (~BallEvent.extra_type.in_(["wide", "no_ball"])))
        .count()
    )
    if legal_ball and current_legal >= (match_obj.overs_per_innings * 6):
        raise HTTPException(status_code=400, detail="Innings overs limit reached")

    event = BallEvent(
        match_id=match_id,
        innings=innings_in_use,
        over_number=auto_over_number,
        ball_number=auto_ball_number,
        batting_team=batting_team_in_use,
        striker_id=payload.striker_id,
        bowler_id=payload.bowler_id,
        runs_off_bat=payload.runs_off_bat,
        extras=payload.extras,
        extra_type=payload.extra_type,
        is_wicket=payload.is_wicket,
        wicket_type=payload.wicket_type,
        commentary=payload.commentary,
        created_by_id=current_user.id,
    )

    db.add(event)
    db.commit()

    scoreboard = build_scoreboard(db, match_obj, innings_in_use)

    innings_over = False
    match_completed = False

    team_player_count = get_batting_side_player_count(db, match_id, batting_team_in_use)
    all_out_limit = max(1, team_player_count - 1)
    if team_player_count > 0 and scoreboard.wickets >= all_out_limit:
        innings_over = True
        if innings_in_use == 1:
            match_obj.current_innings = 2
            match_obj.batting_team = "B" if batting_team_in_use == "A" else "A"
            db.commit()
            db.refresh(match_obj)
        else:
            match_obj.status = "completed"
            db.commit()
            db.refresh(match_obj)
            match_completed = True

    if not match_completed and innings_in_use == 2:
        first_team, second_team = get_innings_teams(db, match_id, batting_team_in_use)
        team_a_runs, team_b_runs, _, _ = get_team_totals(db, match_id)
        first_score = team_a_runs if first_team == "A" else team_b_runs
        second_score = team_a_runs if second_team == "A" else team_b_runs

        if second_score > first_score:
            match_obj.status = "completed"
            db.commit()
            db.refresh(match_obj)
            match_completed = True
            innings_over = True

    next_innings = match_obj.current_innings or innings_in_use
    next_over_number, next_ball_number = get_next_delivery_position(db, match_id, next_innings)

    return {
        "message": "Ball recorded",
        "innings_over": innings_over,
        "match_completed": match_completed,
        "match_status": match_obj.status,
        "recorded_ball": {
            "innings": innings_in_use,
            "over_number": auto_over_number,
            "ball_number": auto_ball_number,
        },
        "next_ball": {
            "innings": next_innings,
            "over_number": next_over_number,
            "ball_number": next_ball_number,
            "batting_team": match_obj.batting_team,
        },
        "scoreboard": scoreboard,
    }


@router.get("/{match_id}/scoreboard", response_model=MatchScoreboardResponse)
async def get_match_scoreboard(
    match_id: int,
    innings: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    match_obj = db.query(Match).filter(Match.id == match_id).first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    return build_scoreboard(db, match_obj, innings)


@router.post("/{match_id}/complete", response_model=MatchResponse)
async def complete_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match_obj = db.query(Match).filter(Match.id == match_id).first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    ensure_match_editor(match_obj, current_user)

    match_obj.status = "completed"
    db.commit()
    db.refresh(match_obj)

    log_action("Completed match", user_id=current_user.id, details=f"match_id={match_id}")
    return match_obj
