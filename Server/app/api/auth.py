"""
Authentication endpoints
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import structlog

from app.core.config import settings
from app.core.exceptions import AuthenticationError, ValidationError
from app.services.auth_service import (
    AuthService, get_auth_service, get_current_active_user, get_current_user
)
from app.models.user import User

logger = structlog.get_logger()

router = APIRouter()

# Pydantic models
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int

class TokenData(BaseModel):
    username: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(),
                auth_service: AuthService = Depends(get_auth_service)):
    """Login endpoint"""
    logger.info("Login attempt", username=form_data.username)

    user = await auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        logger.warning("Login failed", username=form_data.username)
        raise AuthenticationError("Incorrect username or password")

    # Update last login
    await auth_service.update_last_login(user)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    refresh_token = auth_service.create_refresh_token(data={"sub": user.username})

    logger.info("Login successful", username=form_data.username, user_id=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/login")
async def login_json(credentials: UserLogin,
                    auth_service: AuthService = Depends(get_auth_service)):
    """Login with JSON credentials"""
    logger.info("JSON login attempt", username=credentials.username)

    user = await auth_service.authenticate_user(credentials.username, credentials.password)
    if not user:
        logger.warning("JSON login failed", username=credentials.username)
        raise AuthenticationError("Incorrect username or password")

    # Update last login
    await auth_service.update_last_login(user)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    refresh_token = auth_service.create_refresh_token(data={"sub": user.username})

    logger.info("JSON login successful", username=credentials.username, user_id=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/register")
async def register(user_data: UserRegister,
                  auth_service: AuthService = Depends(get_auth_service)):
    """Register new user"""
    logger.info("Registration attempt", username=user_data.username, email=user_data.email)

    try:
        # Create new user
        new_user = await auth_service.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name
        )

        logger.info("Registration successful", username=user_data.username, user_id=str(new_user.id))

        return {"message": "User registered successfully", "username": user_data.username, "user_id": str(new_user.id)}

    except ValidationError as e:
        logger.warning("Registration failed", username=user_data.username, error=str(e))
        raise

@router.post("/refresh")
async def refresh_token(refresh_token: str,
                       auth_service: AuthService = Depends(get_auth_service)):
    """Refresh access token"""
    new_access_token = await auth_service.refresh_access_token(refresh_token)
    if new_access_token is None:
        raise AuthenticationError("Invalid refresh token")

    return Token(
        access_token=new_access_token,
        refresh_token=refresh_token,  # Return same refresh token
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user.to_dict()

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """Logout endpoint"""
    logger.info("User logout", username=current_user.username, user_id=str(current_user.id))

    # In a real implementation, you would:
    # 1. Add token to blacklist
    # 2. Clear session data
    # 3. Update user activity

    return {"message": "Logout successful"}

@router.get("/verify")
async def verify_token(token: str,
                      auth_service: AuthService = Depends(get_auth_service)):
    """Verify token validity"""
    username = await auth_service.verify_token(token, "access")
    if username is None:
        raise AuthenticationError("Invalid token")

    user = await auth_service.get_user_by_username(username)
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive")

    return {"valid": True, "username": username}