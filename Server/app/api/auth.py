"""Authentication API endpoints."""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.api.deps import get_async_db, get_common_params, get_current_active_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password
)
from app.models.user import User
from app.schemas.auth import (
    Login,
    LoginResponse,
    PasswordReset,
    PasswordResetConfirm,
    RefreshToken,
    Token,
    TFAEnable,
    TFASetup,
    TFAVerify,
    EmailVerification
)
from app.schemas.user import UserCreate, UserResponse

logger = structlog.get_logger()

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Register a new user."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Check if user already exists
    existing_user = await auth_service.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # Create user
    user = await auth_service.create_user(user_data)

    # Send verification email
    await auth_service.send_verification_email(user)

    return UserResponse.from_orm(user)


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Login user and return access token."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Authenticate user
    user = await auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Create tokens
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires
    )

    refresh_token_expires = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        subject=str(user.id),
        expires_delta=refresh_token_expires
    )

    # Create session
    await auth_service.create_session(
        user_id=user.id,
        access_token=access_token,
        refresh_token=refresh_token
    )

    # Update last login
    await auth_service.update_last_login(user.id)

    return LoginResponse(
        user=UserResponse.from_orm(user),
        token=Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: RefreshToken,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Refresh access token."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Verify refresh token
    user_id = auth_service.verify_refresh_token(token_data.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Check if session exists
    session = await auth_service.get_session_by_refresh_token(token_data.refresh_token)
    if not session or not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        )

    # Get user
    user = await auth_service.get_user_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Create new access token
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires
    )

    # Update session
    await auth_service.update_session_access_token(
        session_id=session.id,
        access_token=access_token
    )

    return Token(
        access_token=access_token,
        refresh_token=token_data.refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout")
async def logout(
    token_data: RefreshToken,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Logout user and invalidate tokens."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Invalidate session
    await auth_service.invalidate_session_by_refresh_token(token_data.refresh_token)

    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
async def forgot_password(
    data: PasswordReset,
    request: Request,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Send password reset email."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Get user
    user = await auth_service.get_user_by_email(data.email)
    if not user:
        # Don't reveal that user doesn't exist
        return {"message": "If email exists, password reset instructions have been sent"}

    # Generate reset token
    reset_token = await auth_service.generate_password_reset_token(user)

    # Send reset email
    await auth_service.send_password_reset_email(
        user=user,
        reset_token=reset_token,
        request=request
    )

    return {"message": "If email exists, password reset instructions have been sent"}


@router.post("/reset-password")
async def reset_password(
    data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Reset password with token."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Verify reset token
    user = await auth_service.verify_password_reset_token(data.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Update password
    await auth_service.update_user_password(
        user_id=user.id,
        new_password=data.new_password
    )

    # Invalidate all sessions
    await auth_service.invalidate_all_user_sessions(user.id)

    return {"message": "Password reset successfully"}


@router.post("/verify-email")
async def verify_email(
    data: EmailVerification,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Verify email with token."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Verify token
    user = await auth_service.verify_email_token(data.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    # Mark email as verified
    await auth_service.verify_user_email(user.id)

    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    email: str,
    request: Request,
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Resend email verification."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Get user
    user = await auth_service.get_user_by_email(email)
    if not user:
        # Don't reveal that user doesn't exist
        return {"message": "If email exists, verification instructions have been sent"}

    if user.is_verified:
        return {"message": "Email already verified"}

    # Send verification email
    await auth_service.send_verification_email(user)

    return {"message": "If email exists, verification instructions have been sent"}


@router.post("/2fa/setup", response_model=TFASetup)
async def setup_2fa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Setup two-factor authentication."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Generate TFA secret
    secret, qr_code, backup_codes = await auth_service.setup_2fa(current_user.id)

    return TFASetup(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes
    )


@router.post("/2fa/enable")
async def enable_2fa(
    data: TFAEnable,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Enable two-factor authentication."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Verify password
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password"
        )

    # Verify TFA code
    if not await auth_service.verify_2fa_code(current_user.id, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )

    # Enable 2FA
    await auth_service.enable_2fa(current_user.id)

    return {"message": "Two-factor authentication enabled"}


@router.post("/2fa/disable")
async def disable_2fa(
    password: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
) -> Any:
    """Disable two-factor authentication."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)

    # Verify password
    if not verify_password(password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password"
        )

    # Disable 2FA
    await auth_service.disable_2fa(current_user.id)

    return {"message": "Two-factor authentication disabled"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Get current user information."""
    return UserResponse.from_orm(current_user)