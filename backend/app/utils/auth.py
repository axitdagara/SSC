from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from app.config import settings
from fastapi import HTTPException, status
import logging
import json
import os

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

logger = logging.getLogger(__name__)
_firebase_initialized = False

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def _init_firebase_if_needed() -> None:
    global _firebase_initialized

    if _firebase_initialized:
        return

    if firebase_admin._apps:
        _firebase_initialized = True
        return

    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            account_info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(account_info)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            return
        except Exception as e:
            logger.warning("Firebase init from JSON failed: %s", str(e))

    if settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
        if os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                _firebase_initialized = True
                return
            except Exception as e:
                logger.warning("Firebase init from service account path failed: %s", str(e))

    logger.warning("Firebase Auth is enabled but service account credentials are not configured correctly")


def decode_token(token: str):
    """Decode and validate JWT token (legacy local JWT + Firebase ID token)."""
    # 1) Legacy local JWT support
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email:
            return {
                "email": email,
                "sub": payload.get("sub"),
                "name": payload.get("name"),
            }
    except JWTError:
        pass

    # 2) Firebase ID token support
    if settings.FIREBASE_AUTH_ENABLED:
        _init_firebase_if_needed()
        if _firebase_initialized:
            try:
                decoded = firebase_auth.verify_id_token(token)
                email = decoded.get("email")
                name = decoded.get("name")
                sub = decoded.get("uid") or decoded.get("sub")

                if email:
                    return {
                        "email": email,
                        "sub": sub,
                        "name": name,
                    }
            except Exception as e:
                logger.warning("Firebase token validation failed: %s", str(e))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
