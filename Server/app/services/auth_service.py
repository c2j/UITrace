"""
Authentication service for UITrace
"""

from datetime import datetime, timedelta
from typing import Optional
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import structlog

from app.core.config import settings
from app.core.exceptions import AuthenticationError, ValidationError
from app.db.session import get_db
from app.models.user import User, UserRole

logger = structlog.get_logger()

# Security configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")


class AuthService:
    """Authentication service for user management"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Hash password"""
        return pwd_context.hash(password)

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.db.execute(
            select(User).where(User.username == username, User.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(
            select(User).where(User.email == email, User.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_user_by_oauth_id(self, oauth_provider: str, oauth_id: str) -> Optional[User]:
        """Get user by OAuth provider and ID"""
        result = await self.db.execute(
            select(User).where(
                User.oauth_provider == oauth_provider,
                User.oauth_id == oauth_id,
                User.is_active == True
            )
        )
        return result.scalar_one_or_none()

    async def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        user = await self.get_user_by_username(username)
        if not user:
            return None
        if not user.password_hash:
            return None  # OAuth user, no password
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    async def create_user(self, username: str, email: str, password: str, full_name: Optional[str] = None) -> User:
        """Create a new user"""
        # Check if user already exists
        existing_user = await self.get_user_by_username(username)
        if existing_user:
            raise ValidationError("Username already exists")

        existing_email = await self.get_user_by_email(email)
        if existing_email:
            raise ValidationError("Email already exists")

        # Create new user
        hashed_password = self.get_password_hash(password)
        new_user = User(
            username=username,
            email=email,
            password_hash=hashed_password,
            full_name=full_name or username,
            role=UserRole.TESTER,
            is_active=True,
            is_verified=False
        )

        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)

        logger.info("User created successfully", user_id=str(new_user.id), username=username)
        return new_user

    async def create_oauth_user(self, oauth_provider: str, oauth_id: str, email: str,
                          full_name: Optional[str] = None, avatar_url: Optional[str] = None) -> User:
        """Create a new OAuth user"""
        # Check if user already exists
        existing_user = await self.get_user_by_oauth_id(oauth_provider, oauth_id)
        if existing_user:
            return existing_user

        # Check if email is already used
        existing_email = await self.get_user_by_email(email)
        if existing_email:
            # Link OAuth to existing user
            existing_user.oauth_provider = oauth_provider
            existing_user.oauth_id = oauth_id
            existing_user.avatar_url = avatar_url or existing_user.avatar_url
            await self.db.commit()
            await self.db.refresh(existing_user)
            return existing_user

        # Create new OAuth user
        username = f"{oauth_provider}_{oauth_id[:8]}"  # Generate username
        new_user = User(
            username=username,
            email=email,
            oauth_provider=oauth_provider,
            oauth_id=oauth_id,
            full_name=full_name,
            avatar_url=avatar_url,
            role=UserRole.TESTER,
            is_active=True,
            is_verified=True  # OAuth users are pre-verified
        )

        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)

        logger.info("OAuth user created successfully", user_id=str(new_user.id),
                   oauth_provider=oauth_provider, oauth_id=oauth_id)
        return new_user

    async def update_last_login(self, user: User):
        """Update user's last login time"""
        user.last_login = datetime.utcnow()
        await self.db.commit()

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    def create_refresh_token(self, data: dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    async def verify_token(self, token: str, token_type: str = "access") -> Optional[str]:
        """Verify JWT token and return username"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username: str = payload.get("sub")
            payload_type: str = payload.get("type")

            if username is None or payload_type != token_type:
                return None

            return username
        except JWTError:
            return None

    async def get_current_user_from_token(self, token: str) -> Optional[User]:
        """Get current user from JWT token"""
        username = await self.verify_token(token, "access")
        if username is None:
            return None

        user = await self.get_user_by_username(username)
        if user is None or not user.is_active:
            return None

        return user

    async def refresh_access_token(self, refresh_token: str) -> Optional[str]:
        """Refresh access token using refresh token"""
        username = await self.verify_token(refresh_token, "refresh")
        if username is None:
            return None

        user = await self.get_user_by_username(username)
        if user is None or not user.is_active:
            return None

        return self.create_access_token(data={"sub": user.username})


# Dependency for getting auth service
def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    """Get auth service instance"""
    return AuthService(db)


# Dependency for getting current user
async def get_current_user(token: str = Depends(oauth2_scheme),
                          auth_service: AuthService = Depends(get_auth_service)) -> User:
    """Get current authenticated user"""
    user = await auth_service.get_current_user_from_token(token)
    if user is None:
        raise AuthenticationError("Could not validate credentials")
    return user


# Dependency for getting current active user
async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise AuthenticationError("Inactive user")
    return current_user