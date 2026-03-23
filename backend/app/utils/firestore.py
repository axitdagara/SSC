from datetime import datetime
from typing import Any

import firebase_admin
from firebase_admin import firestore

from app.config import settings
from app.utils.auth import _init_firebase_if_needed


def _get_firestore_client():
    """Return Firestore client when Firebase is configured, else None."""
    if not settings.FIREBASE_AUTH_ENABLED:
        return None

    _init_firebase_if_needed()
    if not firebase_admin._apps:
        return None

    return firestore.client()


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def sync_user_profile_to_firestore(user: Any) -> None:
    """Upsert a SQL user profile into Firestore to support phased DB migration."""
    client = _get_firestore_client()
    if client is None:
        return

    doc_id = str(getattr(user, "id", ""))
    if not doc_id:
        return

    payload = {
        "id": doc_id,
        "name": getattr(user, "name", None),
        "email": getattr(user, "email", None),
        "role": getattr(user, "role", "player"),
        "jersey_number": getattr(user, "jersey_number", None),
        "bio": getattr(user, "bio", None),
        "runs": getattr(user, "runs", 0),
        "matches": getattr(user, "matches", 0),
        "wickets": getattr(user, "wickets", 0),
        "centuries": getattr(user, "centuries", 0),
        "half_centuries": getattr(user, "half_centuries", 0),
        "average_runs": getattr(user, "average_runs", 0.0),
        "highest_score": getattr(user, "highest_score", 0),
        "is_premium": getattr(user, "is_premium", False),
        "premium_expiry": _serialize_datetime(getattr(user, "premium_expiry", None)),
        "premium_start_date": _serialize_datetime(getattr(user, "premium_start_date", None)),
        "is_active": getattr(user, "is_active", True),
        "created_at": _serialize_datetime(getattr(user, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(user, "updated_at", None)),
        "last_login": _serialize_datetime(getattr(user, "last_login", None)),
        "source": "sql-mirror",
    }

    client.collection("users").document(doc_id).set(payload, merge=True)
