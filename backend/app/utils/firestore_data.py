from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Callable

import firebase_admin
from firebase_admin import firestore

from app.config import settings
from app.utils.auth import _init_firebase_if_needed


@dataclass
class CollectionNames:
    users: str = "users"
    payments: str = "payments"
    performance_logs: str = "performance_logs"
    notifications: str = "notifications"
    finance_transactions: str = "finance_transactions"
    admin_chat_messages: str = "admin_chat_messages"
    matches: str = "matches"
    match_players: str = "match_players"
    ball_events: str = "ball_events"


COLL = CollectionNames()


def _client():
    if not settings.FIREBASE_AUTH_ENABLED:
        raise RuntimeError("FIREBASE_AUTH_ENABLED must be True for Firestore mode")

    _init_firebase_if_needed()
    if not firebase_admin._apps:
        raise RuntimeError("Firebase Admin is not initialized. Check service account config.")

    return firestore.client()


def _counter_doc(collection: str) -> str:
    return f"counter::{collection}"


def next_int_id(collection: str) -> int:
    client = _client()
    ref = client.collection("_meta").document(_counter_doc(collection))
    snap = ref.get()
    current = 0
    if snap.exists:
        current = int((snap.to_dict() or {}).get("value", 0))
    new_value = current + 1
    ref.set({"value": new_value}, merge=True)
    return new_value


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_doc(collection: str, data: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
    client = _client()
    payload = dict(data)
    if doc_id is None:
        doc_id = str(payload.get("id") or next_int_id(collection))
    payload.setdefault("id", int(doc_id) if doc_id.isdigit() else doc_id)
    client.collection(collection).document(doc_id).set(payload, merge=True)
    return payload


def get_doc(collection: str, doc_id: str | int) -> dict[str, Any] | None:
    client = _client()
    snap = client.collection(collection).document(str(doc_id)).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if "id" not in data:
        data["id"] = int(str(doc_id)) if str(doc_id).isdigit() else str(doc_id)
    return data


def update_doc(collection: str, doc_id: str | int, patch: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_doc(collection, doc_id)
    if not existing:
        return None
    merged = dict(existing)
    merged.update(patch)
    create_doc(collection, merged, str(doc_id))
    return merged


def delete_doc(collection: str, doc_id: str | int) -> bool:
    client = _client()
    snap = client.collection(collection).document(str(doc_id)).get()
    if not snap.exists:
        return False
    client.collection(collection).document(str(doc_id)).delete()
    return True

def _parse_datetime(value: Any) -> datetime | None:
    """Parse a value to datetime if it's a datetime string. Always returns timezone-aware UTC."""
    if isinstance(value, datetime):
        # If naive, make it aware as UTC
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, str):
        try:
            # Only try parsing if it looks like ISO format (contains T or -)
            if 'T' in value or (value.count('-') >= 2):
                if value.endswith('Z'):
                    value = value.replace('Z', '+00:00')
                dt = datetime.fromisoformat(value)
                # If naive, make it aware as UTC
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
        except (ValueError, AttributeError):
            pass
    return None


def _normalize_sort_value(value: Any) -> Any:
    """Normalize a value for sorting - handle datetime and string representations."""
    if value is None:
        return (0, "")
    
    # Try to parse as datetime
    if isinstance(value, datetime):
        return (1, value)
    if isinstance(value, str):
        parsed_dt = _parse_datetime(value)
        if parsed_dt:
            return (1, parsed_dt)
        return (2, value)
    
    # Numbers (int, float)
    if isinstance(value, (int, float)):
        return (3, value)
    
    return (4, str(value))


def list_docs(
    collection: str,
    predicate: Callable[[dict[str, Any]], bool] | None = None,
    sort_key: str | None = None,
    reverse: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict[str, Any]]:
    client = _client()
    rows: list[dict[str, Any]] = []
    for snap in client.collection(collection).stream():
        row = snap.to_dict() or {}
        doc_id = snap.id
        
        # Always track the actual Firestore document ID
        row["_doc_id"] = doc_id
        
        # If no id field, use the Firestore document ID
        if "id" not in row:
            row["id"] = int(doc_id) if doc_id.isdigit() else doc_id
        if predicate and not predicate(row):
            continue
        rows.append(row)

    if sort_key:
        rows.sort(key=lambda item: _normalize_sort_value(item.get(sort_key)), reverse=reverse)

    if offset:
        rows = rows[offset:]
    if limit is not None:
        rows = rows[:limit]
    return rows


def first_doc(
    collection: str,
    predicate: Callable[[dict[str, Any]], bool] | None = None,
    sort_key: str | None = None,
    reverse: bool = False,
) -> dict[str, Any] | None:
    rows = list_docs(collection, predicate=predicate, sort_key=sort_key, reverse=reverse, limit=1)
    return rows[0] if rows else None


def as_obj(data: dict[str, Any]) -> Any:
    return SimpleNamespace(**data)


def normalize_user(user: dict[str, Any]) -> dict[str, Any]:
    """Ensure all required user fields exist with defaults."""
    created_at = user.get("created_at") or user.get("createdAt") or now_utc()
    
    # Prefer uid (Firebase UID) over id for consistency across Firestore
    user_id = user.get("uid") or user.get("id", "")
    
    defaults = {
        "id": user_id,
        "uid": user.get("uid") or user.get("id", ""),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", "player"),
        "jersey_number": user.get("jersey_number"),
        "bio": user.get("bio"),
        "runs": int(user.get("runs", 0)) if user.get("runs") else 0,
        "matches": int(user.get("matches", 0)) if user.get("matches") else 0,
        "wickets": int(user.get("wickets", 0)) if user.get("wickets") else 0,
        "centuries": int(user.get("centuries", 0)) if user.get("centuries") else 0,
        "half_centuries": int(user.get("half_centuries", 0)) if user.get("half_centuries") else 0,
        "average_runs": float(user.get("average_runs", 0.0)) if user.get("average_runs") else 0.0,
        "highest_score": int(user.get("highest_score", 0)) if user.get("highest_score") else 0,
        "is_premium": bool(user.get("is_premium", False)),
        "premium_expiry": user.get("premium_expiry"),
        "is_active": bool(user.get("is_active", True)),
        "created_at": created_at,
    }
    return defaults
