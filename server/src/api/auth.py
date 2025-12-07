"""
Authentication API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional

from ..core.database import get_session
from ..middleware.auth import get_current_user_id, create_access_token, create_refresh_token
from ..models.user import User
from ..services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


# Request models
class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# Response models
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str]
    role: str
    created_at: str
    last_login: Optional[str]
    is_active: bool


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_session)
):
    """User login endpoint"""
    try:
        # Authenticate user
        user = await AuthService.authenticate_user(request.username, request.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        # Create token pair
        tokens = await AuthService.create_token_pair(str(user.id))

        return tokens

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    session: AsyncSession = Depends(get_session)
):
    """User registration endpoint"""
    try:
        # Create new user
        user = await AuthService.create_user(
            username=request.username,
            email=request.email,
            password=request.password,
            full_name=request.full_name
        )

        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            created_at=user.created_at.isoformat(),
            last_login=user.last_login.isoformat() if user.last_login else None,
            is_active=user.is_active
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest
):
    """Refresh access token"""
    try:
        # Validate refresh token and create new access token
        user_id = AuthService.get_user_id_from_refresh_token(request.refresh_token)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

        # Create new tokens
        tokens = await AuthService.create_token_pair(user_id)

        return tokens

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Get current user information"""
    user = await AuthService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        created_at=user.created_at.isoformat(),
        last_login=user.last_login.isoformat() if user.last_login else None,
        is_active=user.is_active
    )


@router.post("/logout")
async def logout(user_id: str = Depends(get_current_user_id)):
    """Logout user (invalidate token)"""
    # In a real implementation, you might want to:
    # 1. Invalidate the JWT token (if using token blacklist)
    # 2. Clear refresh token
    # 3. Log the logout event

    # For now, just return success
    return {"message": "Logout successful"}