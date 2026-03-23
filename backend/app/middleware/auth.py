from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.auth import decode_token
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, now_utc, update_doc

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get current authenticated user"""
    token = credentials.credentials
    token_data = decode_token(token)
    email = token_data.get("email")
    display_name = token_data.get("name")
    
    user = first_doc(COLL.users, predicate=lambda row: row.get("email") == email)

    if user and user.get("updated_at") is None:
        user["updated_at"] = now_utc()

    if not user and email:
        inferred_name = display_name or email.split("@")[0]
        user = create_doc(
            COLL.users,
            {
                "name": inferred_name,
                "email": email,
                "password": "",
                "role": "player",
                "jersey_number": None,
                "bio": None,
                "runs": 0,
                "matches": 0,
                "wickets": 0,
                "centuries": 0,
                "half_centuries": 0,
                "average_runs": 0.0,
                "highest_score": 0,
                "is_premium": False,
                "premium_expiry": None,
                "premium_start_date": None,
                "is_active": True,
                "created_at": now_utc(),
                "updated_at": now_utc(),
                "last_login": None,
            },
        )
    
    if not user or not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    update_doc(COLL.users, user["id"], {"updated_at": now_utc()})
    
    return as_obj(user)


async def get_admin_user(
    current_user = Depends(get_current_user),
):
    """Verify current user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access this resource",
        )
    return current_user
