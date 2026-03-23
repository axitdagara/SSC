from datetime import datetime, timedelta, timezone
from app.utils.firestore_data import now_utc


def check_and_downgrade_premium(user: dict) -> bool:
    """Return True when the given premium user should be downgraded."""
    if not (user.get("is_premium") and user.get("premium_expiry")):
        return False
    expiry = user["premium_expiry"]
    if isinstance(expiry, str):
        from app.utils.firestore_data import _parse_datetime
        expiry = _parse_datetime(expiry)
    if not isinstance(expiry, datetime):
        return False
    return now_utc() >= expiry


def premium_patch(days: int = 30) -> dict:
    """Generate patch payload to set premium membership fields."""
    return {
        "is_premium": True,
        "premium_start_date": now_utc(),
        "premium_expiry": now_utc() + timedelta(days=days),
    }


def calculate_average_runs(user: dict) -> float:
    matches = int(user.get("matches", 0) or 0)
    if matches == 0:
        return 0.0
    return round(float(user.get("runs", 0)) / matches, 2)
