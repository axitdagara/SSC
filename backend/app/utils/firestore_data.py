from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Callable

import certifi
from bson import ObjectId
from pymongo import MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.config import settings
from app.utils.logger import logger


@dataclass
class CollectionNames:
    users: str = "users"
    payments: str = "payments"
    performance_logs: str = "performance_logs"
    ai_summaries: str = "ai_summaries"
    notifications: str = "notifications"
    finance_transactions: str = "finance_transactions"
    admin_chat_messages: str = "admin_chat_messages"
    matches: str = "matches"
    match_players: str = "match_players"
    ball_events: str = "ball_events"


COLL = CollectionNames()

_mongo_client: MongoClient | None = None


class DatabaseUnavailableError(RuntimeError):
    """Raised when MongoDB is not configured or temporarily unavailable."""


def _mongo_db_name() -> str:
    return settings.MONGODB_DB_NAME or "ssc"


def _client() -> MongoClient:
    global _mongo_client

    if _mongo_client is not None:
        return _mongo_client

    if not settings.MONGODB_URI:
        raise DatabaseUnavailableError("MONGODB_URI is not configured")

    try:
        _mongo_client = MongoClient(
            settings.MONGODB_URI,
            tz_aware=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
            connectTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
            socketTimeoutMS=settings.MONGODB_SOCKET_TIMEOUT_MS,
        )
        # Force an early connectivity check so failures surface clearly in API responses.
        _mongo_client.admin.command("ping")
    except PyMongoError as exc:
        _mongo_client = None
        logger.error(f"MongoDB connectivity check failed | Details: {str(exc)}")
        raise DatabaseUnavailableError(
            "Unable to connect to MongoDB. Verify MONGODB_URI and Atlas network access (allow Hugging Face egress IPs or 0.0.0.0/0)."
        ) from exc

    return _mongo_client


def init_db() -> MongoClient:
    """Initialize and return MongoDB connection. Safe to call multiple times."""
    return _client()


def _collection(name: str) -> Collection:
    db = _client()[_mongo_db_name()]
    return db[name]


def _meta_collection() -> Collection:
    db = _client()[_mongo_db_name()]
    return db["_meta"]


def _counter_doc_key(collection: str) -> str:
    return f"counter::{collection}"


def next_int_id(collection: str) -> int:
    doc = _meta_collection().find_one_and_update(
        {"key": _counter_doc_key(collection)},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int((doc or {}).get("value", 1))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_doc_id(value: str | int) -> str | int:
    value_str = str(value)
    return int(value_str) if value_str.isdigit() else value_str


def _serialize_for_mongo(value: Any) -> Any:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return value


def _prepare_payload(data: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key, value in data.items():
        payload[key] = _serialize_for_mongo(value)
    return payload


def _row_from_doc(doc: dict[str, Any]) -> dict[str, Any]:
    row = dict(doc)
    mongo_id = row.pop("_id", None)
    if mongo_id is not None:
        row["_mongo_id"] = str(mongo_id)
    if "id" not in row:
        row["id"] = row.get("_mongo_id", "")
    row.setdefault("_doc_id", row.get("id"))
    return row


def create_doc(collection: str, data: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
    coll = _collection(collection)
    payload = _prepare_payload(dict(data))

    if doc_id is None:
        payload["id"] = payload.get("id") or next_int_id(collection)
    else:
        payload["id"] = _coerce_doc_id(doc_id)

    coll.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    payload.setdefault("_doc_id", payload["id"])
    return payload


def get_doc(collection: str, doc_id: str | int) -> dict[str, Any] | None:
    coll = _collection(collection)
    coerced = _coerce_doc_id(doc_id)

    doc = coll.find_one({"id": coerced})
    if doc is None and ObjectId.is_valid(str(doc_id)):
        doc = coll.find_one({"_id": ObjectId(str(doc_id))})
    if doc is None:
        return None
    return _row_from_doc(doc)


def update_doc(collection: str, doc_id: str | int, patch: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_doc(collection, doc_id)
    if not existing:
        return None
    merged = dict(existing)
    merged.update(_prepare_payload(patch))
    create_doc(collection, merged, str(doc_id))
    return merged


def delete_doc(collection: str, doc_id: str | int) -> bool:
    coll = _collection(collection)
    coerced = _coerce_doc_id(doc_id)

    result = coll.delete_one({"id": coerced})
    if result.deleted_count:
        return True

    if not ObjectId.is_valid(str(doc_id)):
        return False

    oid_result = coll.delete_one({"_id": ObjectId(str(doc_id))})
    return bool(oid_result.deleted_count)

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
    coll = _collection(collection)
    rows: list[dict[str, Any]] = []
    for doc in coll.find({}):
        row = _row_from_doc(doc)
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

    # Keep canonical numeric/string user id stable for API routes and links.
    user_id = user.get("id") if user.get("id") is not None else user.get("uid", "")
    
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
