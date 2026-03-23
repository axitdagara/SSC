from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user
from app.schemas import NotificationResponse
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, list_docs, now_utc, update_doc, _parse_datetime
from app.utils.logger import log_action

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _downgrade_if_expired(user: dict) -> bool:
    expiry = user.get("premium_expiry")
    if user.get("is_premium") and expiry:
        # Parse expiry to timezone-aware datetime
        expiry_dt = _parse_datetime(expiry) if isinstance(expiry, str) else expiry
        
        # Ensure expiry_dt is timezone-aware
        if isinstance(expiry_dt, datetime) and expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
        
        # Check if premium has expired
        if expiry_dt and now_utc() >= expiry_dt:
            update_doc(COLL.users, user["id"], {"is_premium": False, "premium_expiry": None, "updated_at": now_utc()})
        create_doc(
            COLL.notifications,
            {
                "user_id": user["id"],
                "title": "Premium Membership Expired",
                "message": "Your premium membership has expired. Upgrade again to get featured!",
                "notification_type": "premium_expiry",
                "is_read": False,
                "created_at": now_utc(),
            },
        )
        return True
    return False


@router.get("/me", response_model=list[NotificationResponse])
async def get_my_notifications(current_user=Depends(get_current_user)):
    notifications = list_docs(
        COLL.notifications,
        predicate=lambda row: row.get("user_id") == current_user.id,
        sort_key="created_at",
        reverse=True,
        limit=100,
    )
    return [as_obj(row) for row in notifications]


@router.post("/check-expiry")
async def check_premium_expiry_notification(current_user=Depends(get_current_user)):
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    expired = _downgrade_if_expired(user)

    if expired:
        return {
            "message": "Premium already expired. Expiry notification created.",
            "days_left": 0,
            "notification_created": True,
        }

    if not user.get("is_premium") or not user.get("premium_expiry"):
        return {
            "message": "No active premium subscription.",
            "days_left": None,
            "notification_created": False,
        }

    expiry_dt = _parse_datetime(user["premium_expiry"]) if isinstance(user["premium_expiry"], str) else user["premium_expiry"]
    days_left = (expiry_dt - now_utc()).total_seconds() / 86400 if expiry_dt else None

    if days_left > 3:
        return {
            "message": "Premium subscription is active.",
            "days_left": round(days_left, 1),
            "notification_created": False,
        }

    if days_left < 0:
        return {
            "message": "Premium already expired.",
            "days_left": 0,
            "notification_created": False,
        }

    existing = first_doc(
        COLL.notifications,
        predicate=lambda row: row.get("user_id") == current_user.id
        and row.get("notification_type") == "premium_expiry_warning"
        and not row.get("is_read", False),
    )

    if existing:
        return {
            "message": "Expiry warning already exists.",
            "days_left": round(days_left, 1),
            "notification_created": False,
        }

    create_doc(
        COLL.notifications,
        {
            "user_id": current_user.id,
            "title": "Premium Expiry Reminder",
            "message": f"Your premium membership expires in {int(round(days_left))} day(s). Renew to stay featured.",
            "notification_type": "premium_expiry_warning",
            "is_read": False,
            "created_at": now_utc(),
        },
    )

    log_action("Premium expiry warning created", user_id=current_user.id)

    return {
        "message": "Expiry warning created.",
        "days_left": round(days_left, 1),
        "notification_created": True,
    }


@router.put("/{notification_id}/read")
async def mark_notification_as_read(notification_id: int, current_user=Depends(get_current_user)):
    notification = first_doc(
        COLL.notifications,
        predicate=lambda row: row.get("id") == notification_id and row.get("user_id") == current_user.id,
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    update_doc(COLL.notifications, notification_id, {"is_read": True})

    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_notifications_as_read(current_user=Depends(get_current_user)):
    rows = list_docs(
        COLL.notifications,
        predicate=lambda row: row.get("user_id") == current_user.id and not row.get("is_read", False),
    )
    for row in rows:
        update_doc(COLL.notifications, row["id"], {"is_read": True})

    return {"message": "All notifications marked as read"}
