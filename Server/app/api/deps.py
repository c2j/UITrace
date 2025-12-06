"""Common dependencies for API endpoints."""

from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.core.config import settings
from app.core.database import get_async_db
from app.core.security import verify_token
from app.models.user import User
from app.schemas.user import UserInDB

logger = structlog.get_logger()

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)


async def get_current_user(
    db: AsyncSession = Depends(get_async_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> UserInDB:
    """Get the current authenticated user."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from database
    from sqlalchemy import select
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserInDB.from_orm(user)


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user),
) -> UserInDB:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_verified_user(
    current_user: UserInDB = Depends(get_current_active_user),
) -> UserInDB:
    """Get the current verified user."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not verified"
        )
    return current_user


async def get_current_superuser(
    current_user: UserInDB = Depends(get_current_active_user),
) -> UserInDB:
    """Get the current superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[str]:
    """Get optional current user ID from token."""
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "access":
            return None

        return user_id
    except JWTError:
        return None


class PermissionChecker:
    """Permission checker dependency."""

    def __init__(self, required_permissions: list[str]):
        """Initialize with required permissions."""
        self.required_permissions = required_permissions

    def __call__(self, current_user: UserInDB = Depends(get_current_active_user)) -> UserInDB:
        """Check if user has required permissions."""
        if current_user.is_superuser:
            return current_user

        user_permissions = current_user.permissions or []
        user_role_permissions = self._get_role_permissions(current_user.role)
        all_permissions = set(user_permissions + user_role_permissions)

        for permission in self.required_permissions:
            if permission not in all_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )

        return current_user

    @staticmethod
    def _get_role_permissions(role: str) -> list[str]:
        """Get permissions for a role."""
        role_permissions = {
            "admin": [
                "users:read", "users:write", "users:delete",
                "projects:read", "projects:write", "projects:delete",
                "scripts:read", "scripts:write", "scripts:delete",
                "executions:read", "executions:write", "executions:delete",
                "teams:read", "teams:write", "teams:delete",
                "settings:read", "settings:write"
            ],
            "user": [
                "projects:read", "projects:write",
                "scripts:read", "scripts:write",
                "executions:read", "executions:write",
                "teams:read"
            ],
            "viewer": [
                "projects:read",
                "scripts:read",
                "executions:read",
                "teams:read"
            ]
        }
        return role_permissions.get(role, [])


def require_permissions(permissions: list[str]):
    """Require specific permissions."""
    return PermissionChecker(permissions)


class RateLimiter:
    """Simple rate limiter dependency."""

    def __init__(self, requests: int, window_seconds: int):
        """Initialize rate limiter."""
        self.requests = requests
        self.window_seconds = window_seconds
        self.clients = {}

    async def __call__(self, request) -> None:
        """Check rate limit."""
        import time
        from fastapi import Request

        client_ip = request.client.host
        now = time.time()

        # Clean old entries
        cutoff = now - self.window_seconds
        self.clients = {
            ip: timestamps for ip, timestamps in self.clients.items()
            if any(t > cutoff for t in timestamps)
        }

        # Check current client
        if client_ip not in self.clients:
            self.clients[client_ip] = []

        # Remove old timestamps for this client
        self.clients[client_ip] = [
            t for t in self.clients[client_ip] if t > cutoff
        ]

        # Check limit
        if len(self.clients[client_ip]) >= self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )

        # Add current request
        self.clients[client_ip].append(now)


def rate_limit(requests: int, window_seconds: int):
    """Rate limit decorator."""
    return RateLimiter(requests, window_seconds)


async def get_pagination_params(
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Get pagination parameters."""
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20

    offset = (page - 1) * per_page

    return {
        "page": page,
        "per_page": per_page,
        "offset": offset,
        "limit": per_page
    }


class CommonQueryParams:
    """Common query parameters."""

    def __init__(
        self,
        page: int = 1,
        per_page: int = 20,
        sort: Optional[str] = None,
        order: Optional[str] = None,
        search: Optional[str] = None,
    ):
        """Initialize common query parameters."""
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 20

        self.page = page
        self.per_page = per_page
        self.offset = (page - 1) * per_page
        self.limit = per_page
        self.sort = sort
        self.order = order if order in ["asc", "desc"] else "desc"
        self.search = search


def get_common_params(
    page: int = 1,
    per_page: int = 20,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    search: Optional[str] = None,
) -> CommonQueryParams:
    """Get common query parameters."""
    return CommonQueryParams(page, per_page, sort, order, search)


async def verify_api_key(
    api_key: str,
    db: AsyncSession = Depends(get_async_db)
) -> UserInDB:
    """Verify API key and return user."""
    from sqlalchemy import select
    from app.models.user import APIKey

    # Find API key
    result = await db.execute(
        select(APIKey).where(
            APIKey.prefix == api_key[:20],
            APIKey.is_active == True
        )
    )
    key_record = result.scalar_one_or_none()

    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    # Verify full key
    from app.core.security import verify_password
    if not verify_password(api_key, key_record.key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    # Check expiration
    if key_record.expires_at and key_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key expired"
        )

    # Get user
    result = await db.execute(
        select(User).where(
            User.id == key_record.user_id,
            User.is_active == True
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Update last used
    key_record.last_used_at = datetime.utcnow()
    await db.commit()

    return UserInDB.from_orm(user)