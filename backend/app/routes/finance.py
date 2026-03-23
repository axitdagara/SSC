from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.middleware.auth import get_current_user
from app.schemas import GuestFundRequest, ManualCreditRequest, FinanceTransactionResponse
from app.utils.firestore_data import COLL, as_obj, create_doc, list_docs, now_utc
from app.utils.logger import log_action

router = APIRouter(prefix="/finance", tags=["Finance"])


def require_admin(user) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can perform this action")


def calculate_remaining_funds() -> float:
    payments = list_docs(COLL.payments, predicate=lambda row: row.get("status") == "completed")
    transactions = list_docs(COLL.finance_transactions)

    total_payments = sum(float(row.get("amount", 0)) for row in payments)
    total_manual_credits = sum(
        float(row.get("amount", 0))
        for row in transactions
        if row.get("transaction_type") == "credit" and row.get("category") == "manual_credit"
    )
    total_debits = sum(float(row.get("amount", 0)) for row in transactions if row.get("transaction_type") == "debit")

    return round((total_payments + total_manual_credits) - total_debits, 2)


@router.get("/overview")
async def get_finance_overview(current_user=Depends(get_current_user)):
    active_players = list_docs(COLL.users, predicate=lambda row: row.get("is_active", True) and row.get("role") == "player")
    payments = list_docs(COLL.payments, predicate=lambda row: row.get("status") == "completed")
    transactions = list_docs(COLL.finance_transactions)

    paid_user_ids = {row.get("user_id") for row in payments}
    unpaid_players = [player for player in active_players if player.get("id") not in paid_user_ids]

    total_collected = sum(float(row.get("amount", 0)) for row in payments)
    total_guest_fund_used = sum(
        float(row.get("amount", 0))
        for row in transactions
        if row.get("transaction_type") == "debit" and row.get("category") == "guest_fund"
    )

    pending_funds = len(unpaid_players) * settings.PREMIUM_COST
    funds_remaining = calculate_remaining_funds()

    return {
        "total_collected": round(total_collected, 2),
        "pending_funds": round(float(pending_funds), 2),
        "funds_remaining": funds_remaining,
        "total_guest_fund_used": round(total_guest_fund_used, 2),
        "paid_players_count": len(paid_user_ids),
        "unpaid_players_count": len(unpaid_players),
        "premium_cost_per_player": settings.PREMIUM_COST,
    }


@router.get("/player-payments")
async def get_player_payments(current_user=Depends(get_current_user)):
    players = list_docs(COLL.users, predicate=lambda row: row.get("is_active", True) and row.get("role") == "player")
    all_payments = list_docs(COLL.payments, predicate=lambda row: row.get("status") == "completed")

    result = []
    for player in players:
        payments = [row for row in all_payments if row.get("user_id") == player.get("id")]
        payments.sort(key=lambda row: row.get("created_at") or now_utc(), reverse=True)

        amount_paid = round(sum(float(payment.get("amount", 0)) for payment in payments), 2)
        last_payment_date = payments[0].get("created_at") if payments else None

        result.append(
            {
                "user_id": player.get("id"),
                "name": player.get("name"),
                "email": player.get("email"),
                "is_premium": player.get("is_premium", False),
                "amount_paid": amount_paid,
                "has_paid": amount_paid >= settings.PREMIUM_COST,
                "last_payment_date": last_payment_date,
                "due_amount": max(0, settings.PREMIUM_COST - amount_paid),
            }
        )

    result.sort(key=lambda row: (not row["has_paid"], (row["name"] or "").lower()))
    return result


@router.get("/transactions", response_model=list[FinanceTransactionResponse])
async def get_finance_transactions(current_user=Depends(get_current_user)):
    transactions = list_docs(COLL.finance_transactions, sort_key="created_at", reverse=True, limit=100)
    return [as_obj(row) for row in transactions]


@router.post("/guest-fund")
async def record_guest_fund_expense(payload: GuestFundRequest, current_user=Depends(get_current_user)):
    require_admin(current_user)

    if payload.guest_fund <= 0:
        raise HTTPException(status_code=400, detail="Guest fund should be greater than zero")

    description = f"Match: {payload.match_name}"
    if payload.notes:
        description = f"{description} | {payload.notes}"

    create_doc(
        COLL.finance_transactions,
        {
            "user_id": None,
            "transaction_type": "debit",
            "amount": payload.guest_fund,
            "category": "guest_fund",
            "description": description,
            "reference_id": None,
            "created_at": now_utc(),
        },
    )

    funds_remaining = calculate_remaining_funds()
    log_action("Guest fund expense recorded", user_id=current_user.id, details=description)

    return {
        "message": "Guest fund expense recorded",
        "debit_amount": payload.guest_fund,
        "funds_remaining": funds_remaining,
    }


@router.post("/manual-credit")
async def record_manual_credit(payload: ManualCreditRequest, current_user=Depends(get_current_user)):
    require_admin(current_user)

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Credit amount should be greater than zero")

    create_doc(
        COLL.finance_transactions,
        {
            "user_id": payload.user_id,
            "transaction_type": "credit",
            "amount": payload.amount,
            "category": "manual_credit",
            "description": payload.notes or "Manual fund credit",
            "reference_id": None,
            "created_at": now_utc(),
        },
    )

    funds_remaining = calculate_remaining_funds()
    log_action("Manual fund credit recorded", user_id=current_user.id, details=str(payload.amount))

    return {
        "message": "Manual credit added",
        "credit_amount": payload.amount,
        "funds_remaining": funds_remaining,
    }
