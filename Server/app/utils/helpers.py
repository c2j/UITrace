"""Helper functions and utilities."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Union

from passlib.context import CryptContext
import pytz


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


def generate_uuid_from_string(value: str) -> str:
    """Generate a deterministic UUID from a string."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, value))


def generate_random_string(length: int = 32) -> str:
    """Generate a cryptographically secure random string."""
    return secrets.token_urlsafe(length)[:length]


def generate_short_code(length: int = 8) -> str:
    """Generate a short random code."""
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def hash_string(value: str, salt: str = "") -> str:
    """Hash a string with optional salt."""
    if salt:
        value = f"{value}{salt}"
    return hashlib.sha256(value.encode()).hexdigest()


def verify_hash(value: str, hashed_value: str, salt: str = "") -> bool:
    """Verify a value against its hash."""
    return hash_string(value, salt) == hashed_value


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def generate_token(length: int = 32) -> str:
    """Generate a secure token."""
    return secrets.token_urlsafe(length)


def slugify(text: str) -> str:
    """Convert text to a slug."""
    import re

    # Convert to lowercase and replace spaces with hyphens
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)  # Remove special characters
    text = re.sub(r"[-\s]+", "-", text)  # Replace spaces and multiple hyphens with single hyphen
    text = text.strip("-")  # Remove leading/trailing hyphens

    # Ensure it doesn't start with a number
    if text and text[0].isdigit():
        text = f"item-{text}"

    return text or "untitled"


def generate_unique_slug(text: str, existing_slugs: Sequence[str]) -> str:
    """Generate a unique slug based on text and existing slugs."""
    base_slug = slugify(text)
    slug = base_slug
    counter = 1

    while slug in existing_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


def format_datetime(
    dt: datetime,
    format_str: str = "%Y-%m-%d %H:%M:%S",
    timezone: str = "UTC"
) -> str:
    """Format datetime with timezone support."""
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)

    target_tz = pytz.timezone(timezone)
    dt = dt.astimezone(target_tz)

    return dt.strftime(format_str)


def parse_datetime(
    dt_str: str,
    format_str: str = "%Y-%m-%d %H:%M:%S",
    timezone: str = "UTC"
) -> datetime:
    """Parse datetime string with timezone support."""
    dt = datetime.strptime(dt_str, format_str)

    if dt.tzinfo is None:
        target_tz = pytz.timezone(timezone)
        dt = target_tz.localize(dt)

    return dt


def time_ago(dt: datetime) -> str:
    """Get human readable time ago string."""
    now = datetime.utcnow()
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    now = pytz.utc.localize(now)

    diff = now - dt

    if diff.days > 0:
        return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
    elif diff.seconds > 3600:
        hours = diff.seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    elif diff.seconds > 60:
        minutes = diff.seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    else:
        return "just now"


def calculate_percentage(part: float, total: float) -> float:
    """Calculate percentage."""
    if total == 0:
        return 0.0
    return (part / total) * 100


def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert value to int."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert value to float."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def truncate_string(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate string to specified length."""
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix


def clean_dict(data: Dict[str, Any], remove_none: bool = True, remove_empty: bool = False) -> Dict[str, Any]:
    """Clean dictionary by removing None or empty values."""
    cleaned = {}

    for key, value in data.items():
        if remove_none and value is None:
            continue
        if remove_empty and value == "":
            continue
        cleaned[key] = value

    return cleaned


def flatten_dict(data: Dict[str, Any], separator: str = ".") -> Dict[str, Any]:
    """Flatten nested dictionary."""
    def _flatten(obj, parent_key=""):
        items = []

        for k, v in obj.items():
            new_key = f"{parent_key}{separator}{k}" if parent_key else k

            if isinstance(v, dict):
                items.extend(_flatten(v, new_key).items())
            else:
                items.append((new_key, v))

        return dict(items)

    return _flatten(data)


def chunk_list(items: List[Any], chunk_size: int) -> List[List[Any]]:
    """Split list into chunks."""
    chunks = []
    for i in range(0, len(items), chunk_size):
        chunks.append(items[i:i + chunk_size])
    return chunks


def merge_dicts(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two dictionaries recursively."""
    result = dict1.copy()

    for key, value in dict2.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value

    return result


def get_nested_value(data: Dict[str, Any], path: str, default: Any = None) -> Any:
    """Get value from nested dictionary using dot notation."""
    keys = path.split(".")
    current = data

    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default

    return current


def set_nested_value(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
    """Set value in nested dictionary using dot notation."""
    keys = path.split(".")
    current = data

    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]

    current[keys[-1]] = value
    return data


def file_size_human_readable(size_bytes: int) -> str:
    """Convert file size in bytes to human readable format."""
    if size_bytes == 0:
        return "0 B"

    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0

    while size_bytes >= 1024.0 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1

    return f"{size_bytes:.1f} {size_names[i]}"


def duration_human_readable(duration_ms: int) -> str:
    """Convert duration in milliseconds to human readable format."""
    if duration_ms < 1000:
        return f"{duration_ms}ms"
    elif duration_ms < 60000:
        seconds = duration_ms / 1000
        return f"{seconds:.1f}s"
    elif duration_ms < 3600000:
        minutes = duration_ms / 60000
        return f"{minutes:.1f}m"
    else:
        hours = duration_ms / 3600000
        return f"{hours:.1f}h"


def is_valid_email(email: str) -> bool:
    """Check if email is valid."""
    import re

    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def is_valid_url(url: str) -> bool:
    """Check if URL is valid."""
    import re

    pattern = r"^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)$"
    return re.match(pattern, url) is not None


def sanitize_filename(filename: str) -> str:
    """Sanitize filename by removing invalid characters."""
    import re

    # Remove invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', "", filename)
    filename = filename.replace("..", "")

    # Remove leading/trailing dots and spaces
    filename = filename.strip(". ")

    # Ensure filename is not empty
    if not filename:
        filename = "untitled"

    return filename


def get_file_extension(filename: str) -> str:
    """Get file extension from filename."""
    return filename.lower().split(".")[-1] if "." in filename else ""


def mime_type_from_extension(extension: str) -> str:
    """Get MIME type from file extension."""
    mime_types = {
        "txt": "text/plain",
        "json": "application/json",
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml",
        "py": "text/x-python",
        "js": "application/javascript",
        "ts": "application/typescript",
        "html": "text/html",
        "css": "text/css",
    }

    return mime_types.get(extension.lower(), "application/octet-stream")


def retry_on_exception(max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """Decorator to retry function on exception."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            import asyncio

            last_exception = None
            current_delay = delay

            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    if attempt == max_retries - 1:
                        break

                    await asyncio.sleep(current_delay)
                    current_delay *= backoff

            raise last_exception

        return wrapper
    return decorator


def cache_result(ttl: float = 300.0):
    """Decorator to cache function result."""
    def decorator(func):
        _cache = {}

        async def wrapper(*args, **kwargs):
            import asyncio
            import time

            # Create cache key
            key = str(args) + str(sorted(kwargs.items()))

            # Check cache
            if key in _cache:
                cached_time, cached_result = _cache[key]
                if time.time() - cached_time < ttl:
                    return cached_result

            # Execute function and cache result
            result = await func(*args, **kwargs)
            _cache[key] = (time.time(), result)

            # Clean expired entries
            current_time = time.time()
            expired_keys = [
                k for k, (t, _) in _cache.items()
                if current_time - t >= ttl
            ]
            for k in expired_keys:
                del _cache[k]

            return result

        return wrapper
    return decorator