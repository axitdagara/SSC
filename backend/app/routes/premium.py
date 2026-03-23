from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta
from app.schemas import PremiumUpgradeRequest, PremiumResponse, PaymentResponse
from app.middleware.auth import get_current_user
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, list_docs, now_utc, update_doc, _parse_datetime
from app.utils.logger import log_action, log_error
import uuid

router = APIRouter(prefix="/premium", tags=["Premium"])


@router.post("/upgrade", response_model=PremiumResponse)
async def upgrade_to_premium_plan(
    request_data: PremiumUpgradeRequest,
    current_user=Depends(get_current_user),
):
    """Upgrade player to premium membership"""
    
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_premium"):
        # Extend premium period
        current_expiry = user.get("premium_expiry", now_utc())
        if isinstance(current_expiry, str):
            current_expiry = _parse_datetime(current_expiry) or now_utc()
        new_expiry = current_expiry + timedelta(days=request_data.plan_days)
        user = update_doc(
            COLL.users,
            user["id"],
            {"premium_expiry": new_expiry, "updated_at": now_utc()},
        ) or user
    else:
        # New premium membership
        user = update_doc(
            COLL.users,
            user["id"],
            {
                "is_premium": True,
                "premium_start_date": now_utc(),
                "premium_expiry": now_utc() + timedelta(days=request_data.plan_days),
                "updated_at": now_utc(),
            },
        ) or user
    
    # Create payment record
    transaction_id = str(uuid.uuid4())
    create_doc(
        COLL.payments,
        {
            "user_id": user["id"],
            "amount": 1000.0,
            "payment_method": "razorpay",
            "transaction_id": transaction_id,
            "status": "completed",
            "plan_duration_days": request_data.plan_days,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        },
    )

    create_doc(
        COLL.finance_transactions,
        {
            "user_id": user["id"],
            "transaction_type": "credit",
            "amount": 1000.0,
            "category": "premium_payment",
            "description": f"Premium payment by {user.get('email')}",
            "reference_id": transaction_id,
            "created_at": now_utc(),
        },
    )
    
    log_action("Premium upgrade", user_id=user["id"], details=f"{request_data.plan_days} days")
    
    return {
        "is_premium": user.get("is_premium", False),
        "premium_expiry": user.get("premium_expiry"),
        "message": f"Successfully upgraded to premium for {request_data.plan_days} days!"
    }


@router.get("/status", response_model=PremiumResponse)
async def get_premium_status(
    current_user=Depends(get_current_user),
):
    """Get current premium status"""
    
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    expiry = user.get("premium_expiry")
    if user.get("is_premium") and expiry:
        from datetime import timezone
        # Parse expiry to timezone-aware datetime
        expiry_dt = _parse_datetime(expiry) if isinstance(expiry, str) else expiry
        
        # Ensure expiry_dt is timezone-aware
        if isinstance(expiry_dt, datetime) and expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
        
        # Check if premium has expired
        if expiry_dt and now_utc() >= expiry_dt:
            user = update_doc(
                COLL.users,
                user["id"],
                {"is_premium": False, "premium_expiry": None, "updated_at": now_utc()},
            ) or user
    
    if user.get("is_premium"):
        expiry = user.get("premium_expiry")
        from datetime import timezone
        # Ensure timezone-aware datetime for formatting
        if isinstance(expiry, str):
            expiry = _parse_datetime(expiry) or now_utc()
        elif isinstance(expiry, datetime) and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        message = f"Premium active until {expiry.strftime('%Y-%m-%d')}" if expiry else "Premium active"
    else:
        message = "Not a premium member. Upgrade to get featured!"
    
    return {
        "is_premium": user.get("is_premium", False),
        "premium_expiry": user.get("premium_expiry"),
        "message": message
    }


@router.post("/cancel")
async def cancel_premium(
    current_user=Depends(get_current_user),
):
    """Cancel premium membership"""
    
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.get("is_premium"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a premium member"
        )
    
    update_doc(
        COLL.users,
        user["id"],
        {"is_premium": False, "premium_expiry": None, "updated_at": now_utc()},
    )
    
    log_action("Premium cancelled", user_id=user["id"])
    
    return {"message": "Premium membership cancelled"}


@router.get("/payments", response_model=list)
async def get_payment_history(
    current_user=Depends(get_current_user),
):
    """Get payment history"""
    
    payments = list_docs(
        COLL.payments,
        predicate=lambda row: row.get("user_id") == current_user.id,
        sort_key="created_at",
        reverse=True,
    )
    return [as_obj(row) for row in payments]
