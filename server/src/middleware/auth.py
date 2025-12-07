"""
Authentication middleware for JWT token validation
"""

import os
from typing import Optional
from datetime import datetime, timedelta

from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import HTTPConnectionMiddleware
from starlette.requests import Request as StarletteRequest

from ..core.config import settings
from ..core.database import get_session
from ..models.user import User


class JWTMiddleware(HTTPConnectionMiddleware):
    """JWT authentication middleware"""

    async def dispatch(self, request: Request, call_next):
        # Bypass authentication for specific paths
        if self._is_public_path(request.url.path):
            response = await call_next(request)
            return response

        # Extract and validate JWT token
        try:
            credentials = await self._extract_credentials(request)
            if credentials is None:
                self._raise_unauthorized("No authentication credentials provided")

            user = await self._validate_token(credentials)
            if user is None or not user.is_active:
                self._raise_unauthorized("Invalid or expired token")

            # Add user to request state
            request.state.user = user
            request.state.user_id = str(user.id)

            response = await call_next(request)
            return response

        except HTTPException:
            raise
        except Exception as e:
            self._raise_unauthorized(f"Authentication error: {str(e)}")

    def _is_public_path(self, path: str) -> bool:
        """Check if path is public (no authentication required)"""
        public_paths = [
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/health",
            "/metrics",
            "/",
            "/docs",
            "/redoc",
            "/openapi.json"
        ]

        return any(path.startswith(public_path) for public_path in public_paths)

    async def _extract_credentials(self, request: Request) -> Optional[str]:
        """Extract JWT token from request"""
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return None

        if not auth_header.startswith("Bearer "):
            return None

        return auth_header.split(" ")[1].strip()

    async def _validate_token(self, token: str) -> Optional[User]:
        """Validate JWT token and return user"""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": True}
            )

            # Check if token has expired
            exp = payload.get("exp")
            if exp is None or datetime.fromtimestamp(exp) < datetime.utcnow():
                return None

            user_id = payload.get("sub")
            if not user_id:
                return None

            # Fetch user from database
            async with get_session() as session:
                from sqlalchemy import select
                from ..models.user import User

                stmt = select(User).where(User.id == user_id, User.is_active == True)
                result = await session.execute(stmt)
                user = result.scalar_one_or_none()

                return user

        except JWTError:
            return None
        except Exception:
            return None

    def _raise_unauthorized(self, message: str):
        """Raise HTTP 401 Unauthorized exception"""
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message,
            headers={"WWW-Authenticate": "Bearer"},
        )


# HTTPBearer scheme for FastAPI security
security = HTTPBearer()


async def get_current_user(request: Request) -> Optional[User]:
    """Get current authenticated user from request state"""
    return getattr(request.state, "user", None)


async def get_current_user_id(request: Request) -> Optional[str]:
    """Get current user ID from request state"""
    return getattr(request.state, "user_id", None)


async def require_auth(request: Request) -> User:
    """Require authentication, raise exception if not authenticated"""
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return user


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.utcnow() + expires_delta

    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "access",
        "iat": datetime.utcnow()
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token"""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
        "iat": datetime.utcnow()
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )