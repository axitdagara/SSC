from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta
from typing import List

from app.config import settings
from app.schemas import AdminChatCreate, AdminChatResponse
from app.middleware.auth import get_admin_user, get_current_user
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, list_docs, now_utc, update_doc
from app.utils.logger import log_action

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=List)
async def list_all_users(skip: int = 0, limit: int = 100, admin=Depends(get_admin_user)):
    users = list_docs(COLL.users, sort_key="created_at", reverse=True, offset=skip, limit=limit)
    log_action("Admin viewed all users", user_id=admin.id)
    return [
        {
            "id": user.get("id"),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "is_active": user.get("is_active", True),
            "is_premium": user.get("is_premium", False),
            "runs": user.get("runs", 0),
            "matches": user.get("matches", 0),
            "wickets": user.get("wickets", 0),
            "created_at": user.get("created_at"),
        }
        for user in users
    ]


@router.put("/users/{user_id}/premium")
async def toggle_user_premium(user_id: int, days: int = 30, admin=Depends(get_admin_user)):
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    is_premium = not user.get("is_premium", False)
    patch = {"is_premium": is_premium, "updated_at": now_utc()}

    if is_premium:
        from datetime import timedelta
        patch["premium_expiry"] = now_utc() + timedelta(days=days)
        patch["premium_start_date"] = now_utc()
    else:
        patch["premium_expiry"] = None

    update_doc(COLL.users, user_id, patch)
    log_action("Admin toggled user premium", user_id=admin.id, details=f"User {user_id}")

    return {"message": "User premium status updated"}


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: int, admin=Depends(get_admin_user)):
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_doc(COLL.users, user_id, {"is_active": False, "updated_at": now_utc()})

    log_action("Admin deactivated user", user_id=admin.id, details=f"User {user_id}")

    return {"message": "User deactivated successfully"}


@router.get("/stats")
async def get_system_stats(admin=Depends(get_admin_user)):
    users = list_docs(COLL.users)
    payments = list_docs(COLL.payments, predicate=lambda row: row.get("status") == "completed")
    transactions = list_docs(COLL.finance_transactions)
    chats = list_docs(COLL.admin_chat_messages)

    total_users = len(users)
    active_users = len([u for u in users if u.get("is_active", True)])
    premium_users = len([u for u in users if u.get("is_premium", False)])
    total_matches = sum(int(u.get("matches", 0)) for u in users)

    paid_user_ids = {row.get("user_id") for row in payments}
    active_players = [u for u in users if u.get("is_active", True) and u.get("role") == "player"]
    unpaid_players = [u for u in active_players if u.get("id") not in paid_user_ids]

    pending_funds = len(unpaid_players) * settings.PREMIUM_COST

    total_collected = sum(float(row.get("amount", 0)) for row in payments)
    manual_credits = sum(
        float(row.get("amount", 0))
        for row in transactions
        if row.get("transaction_type") == "credit" and row.get("category") == "manual_credit"
    )
    total_debits = sum(float(row.get("amount", 0)) for row in transactions if row.get("transaction_type") == "debit")
    funds_remaining = round((total_collected + manual_credits) - total_debits, 2)

    unread_chat_messages = len(
        [m for m in chats if m.get("sender_role") == "player" and not m.get("is_read", False)]
    )

    log_action("Admin viewed system stats", user_id=admin.id)

    return {
        "total_users": total_users,
        "active_users": active_users,
        "premium_users": premium_users,
        "total_matches": total_matches,
        "pending_funds": pending_funds,
        "funds_remaining": funds_remaining,
        "unread_chat_messages": unread_chat_messages,
    }


@router.get("/chats")
async def get_chat_threads(admin=Depends(get_admin_user)):
    players = list_docs(COLL.users, predicate=lambda row: row.get("role") == "player" and row.get("is_active", True))
    chats = list_docs(COLL.admin_chat_messages, sort_key="created_at", reverse=True)

    threads = []
    for player in players:
        player_messages = [m for m in chats if m.get("user_id") == player.get("id")]
        last_message = player_messages[0] if player_messages else None
        unread_count = len(
            [m for m in player_messages if m.get("sender_role") == "player" and not m.get("is_read", False)]
        )

        threads.append(
            {
                "user_id": player.get("id"),
                "name": player.get("name"),
                "email": player.get("email"),
                "unread_count": unread_count,
                "last_message": last_message.get("message") if last_message else None,
                "last_message_at": last_message.get("created_at") if last_message else None,
            }
        )

    threads.sort(key=lambda item: item["last_message_at"] or datetime.min, reverse=True)
    return threads


@router.get("/chats/{user_id}", response_model=list[AdminChatResponse])
async def get_chat_thread(user_id: int, admin=Depends(get_admin_user)):
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == user_id and row.get("role") == "player")
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")

    messages = list_docs(
        COLL.admin_chat_messages,
        predicate=lambda row: row.get("user_id") == user_id,
        sort_key="created_at",
        reverse=False,
    )

    for message in messages:
        if message.get("sender_role") == "player" and not message.get("is_read", False):
            update_doc(COLL.admin_chat_messages, message["id"], {"is_read": True})
            message["is_read"] = True

    return [as_obj(row) for row in messages]


@router.post("/chats/{user_id}", response_model=AdminChatResponse)
async def send_admin_chat_message(user_id: int, payload: AdminChatCreate, admin=Depends(get_admin_user)):
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == user_id and row.get("role") == "player")
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")

    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chat = create_doc(
        COLL.admin_chat_messages,
        {
            "user_id": user_id,
            "sender_role": "admin",
            "message": message,
            "is_read": False,
            "created_at": now_utc(),
        },
    )

    log_action("Admin chat message sent", user_id=admin.id, details=f"to={user_id}")
    return as_obj(chat)


@router.get("/my-chat", response_model=list[AdminChatResponse])
async def get_my_chat(current_user=Depends(get_current_user)):
    messages = list_docs(
        COLL.admin_chat_messages,
        predicate=lambda row: row.get("user_id") == current_user.id,
        sort_key="created_at",
        reverse=False,
    )

    for message in messages:
        if message.get("sender_role") == "admin" and not message.get("is_read", False):
            update_doc(COLL.admin_chat_messages, message["id"], {"is_read": True})
            message["is_read"] = True

    return [as_obj(row) for row in messages]


@router.post("/my-chat", response_model=AdminChatResponse)
async def send_message_to_admin(payload: AdminChatCreate, current_user=Depends(get_current_user)):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chat = create_doc(
        COLL.admin_chat_messages,
        {
            "user_id": current_user.id,
            "sender_role": "player",
            "message": message,
            "is_read": False,
            "created_at": now_utc(),
        },
    )

    log_action("Player chat message sent", user_id=current_user.id)
    return as_obj(chat)
