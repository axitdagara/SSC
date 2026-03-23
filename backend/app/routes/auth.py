from fastapi import APIRouter, Depends, HTTPException, Request, status
from datetime import timedelta
from app.schemas import UserRegister, UserLogin, Token, UserResponse
from app.utils.auth import hash_password, verify_password, create_access_token
from app.utils.firestore_data import COLL, as_obj, create_doc, first_doc, now_utc, update_doc
from app.utils.logger import log_action, log_error
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=Token)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserRegister):
    """Register a new player"""
    
    # Check if user already exists
    existing_user = first_doc(COLL.users, predicate=lambda row: row.get("email") == user_data.email)
    if existing_user:
        log_error(f"Registration failed: Email already exists", details=user_data.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    new_user = create_doc(
        COLL.users,
        {
            "name": user_data.name,
            "email": user_data.email,
            "password": hash_password(user_data.password),
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
    
    # Create access token
    access_token = create_access_token(
        data={"sub": new_user.email},
        expires_delta=timedelta(minutes=30)
    )
    
    log_action("User registered", user_id=new_user["id"])
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(as_obj(new_user))
    }


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin):
    """Login a player"""
    
    user = first_doc(COLL.users, predicate=lambda row: row.get("email") == credentials.email)
    
    if not user or not verify_password(credentials.password, user.get("password", "")):
        log_error("Login failed: Invalid credentials", details=credentials.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    # Update last login
    update_doc(COLL.users, user["id"], {"last_login": now_utc(), "updated_at": now_utc()})
    user = first_doc(COLL.users, predicate=lambda row: row.get("id") == user["id"])
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=30)
    )
    
    log_action("User logged in", user_id=user["id"])
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(as_obj(user))
    }
