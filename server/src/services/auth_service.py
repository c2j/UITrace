"""
Authentication service for user management and JWT token handling
"""

from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.config import settings
from ..core.database import get_session
from ..models.user import User

# Password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    default="bcrypt",
    bcrypt__rounds=12,
    deprecated="auto"
)


class AuthService:
    """Authentication service for user management and JWT operations"""

    @staticmethod
    async def create_user(
        username: str,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        role: str = "tester"
    ) -> User:
        """Create a new user"""
        async with get_session() as session:
            # Check if username already exists
            existing_user_result = await session.execute(
                select(User).where(
                    (User.username == username) | (User.email == email)
                )
            )
            existing_user = existing_user_result.scalar_one_or_none()

            if existing_user:
                raise ValueError("Username or email already exists")

            # Hash password
            password_hash = pwd_context.hash(password)

            # Create new user
            new_user = User(
                username=username,
                email=email,
                full_name=full_name,
                password_hash=password_hash,
                role=role
            )

            session.add(new_user)
            await session.commit()
            await session.refresh(new_user)

            return new_user

    @staticmethod
    async def authenticate_user(username: str, password: str) -> Optional[User]:
        """Authenticate user with username/password"""
        async with get_session() as session:
            stmt = select(User).where(
                (User.username == username) & (User.is_active == True)
            )
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()

            if not user:
                return None

            # Verify password
            if not pwd_context.verify(password, user.password_hash):
                return None

            # Update last login time
            user.last_login = datetime.utcnow()
            await session.commit()

            return user

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[User]:
        """Get user by ID"""
        try:
            from uuid import UUID
            user_uuid = UUID(user_id)
        except ValueError:
            return None

        async with get_session() as session:
            stmt = select(User).where(User.id == user_uuid)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    @staticmethod
    async def update_user_password(user_id: str, current_password: str, new_password: str) -> bool:
        """Update user password"""
        user = await AuthService.get_user_by_id(user_id)
        if not user:
            return False

        # Verify current password
        if not pwd_context.verify(current_password, user.password_hash):
            return False

        # Hash new password
        new_password_hash = pwd_context.hash(new_password)

        async with get_session() as session:
            user.password_hash = new_password_hash
            await session.commit()
            return True

    @staticmethod
    async def create_token_pair(user_id: str) -> dict:
        """Create JWT access and refresh token pair"""
        access_token = create_access_token(user_id)
        refresh_token = create_refresh_token(user_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": await AuthService.get_user_by_id(user_id)
        }


def create_access_token(user_id: str) -> str:
    """Create JWT access token"""
    from .middleware import create_access_token as create_token

    return create_token(user_id)


def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token"""
    from .middleware import create_refresh_token

    return create_refresh_token(user_id)