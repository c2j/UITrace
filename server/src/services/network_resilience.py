"""
Network resilience service for handling connection failures and retries
"""

import asyncio
import time
import random
from typing import Optional, Dict, Any, Callable, TypeVar, Union
from functools import wraps
import aiohttp
from aiohttp import ClientError, ServerTimeoutError
import structlog
from contextlib import asynccontextmanager

logger = structlog.get_logger()

T = TypeVar('T')


class NetworkResilienceConfig:
    """Configuration for network resilience features"""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        timeout: float = 30.0,
        circuit_breaker_threshold: int = 5,
        circuit_breaker_timeout: float = 60.0,
        connection_pool_size: int = 20,
        connection_pool_max_overflow: int = 30,
        connection_pool_timeout: float = 30.0
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.timeout = timeout
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.circuit_breaker_timeout = circuit_breaker_timeout
        self.connection_pool_size = connection_pool_size
        self.connection_pool_max_overflow = connection_pool_max_overflow
        self.connection_pool_timeout = connection_pool_timeout


class CircuitBreaker:
    """Circuit breaker pattern implementation"""

    def __init__(self, threshold: int = 5, timeout: float = 60.0):
        self.threshold = threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "closed"  # closed, open, half-open
        self._lock = asyncio.Lock()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Call function with circuit breaker protection"""
        async with self._lock:
            if self.state == "open":
                if time.time() - self.last_failure_time > self.timeout:
                    self.state = "half-open"
                    logger.info("Circuit breaker moved to half-open state")
                else:
                    raise Exception("Circuit breaker is open")

        try:
            result = await func(*args, **kwargs)
            async with self._lock:
                if self.state == "half-open":
                    self.state = "closed"
                    self.failure_count = 0
                    logger.info("Circuit breaker closed after successful call")
            return result
        except Exception as e:
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()

                if self.failure_count >= self.threshold:
                    self.state = "open"
                    logger.error(f"Circuit breaker opened after {self.failure_count} failures")

            raise e

    def reset(self):
        """Reset circuit breaker state"""
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "closed"


class RetryHandler:
    """Retry mechanism with exponential backoff and jitter"""

    def __init__(self, config: NetworkResilienceConfig):
        self.config = config

    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt"""
        delay = self.config.base_delay * (self.config.exponential_base ** attempt)
        delay = min(delay, self.config.max_delay)

        if self.config.jitter:
            # Add random jitter (±25% of delay)
            jitter_range = delay * 0.25
            delay = delay + random.uniform(-jitter_range, jitter_range)
            delay = max(0.1, delay)  # Minimum 100ms delay

        return delay

    async def execute_with_retry(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """Execute function with retry logic"""
        last_exception = None

        for attempt in range(self.config.max_retries + 1):
            try:
                if attempt > 0:
                    delay = self.calculate_delay(attempt - 1)
                    logger.info(f"Retrying after {delay:.2f}s (attempt {attempt + 1}/{self.config.max_retries + 1})")
                    await asyncio.sleep(delay)

                result = await func(*args, **kwargs)

                if attempt > 0:
                    logger.info(f"Retry successful on attempt {attempt + 1}")

                return result

            except Exception as e:
                last_exception = e
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")

                # Don't retry on certain exceptions
                if isinstance(e, (ValueError, TypeError, AttributeError)):
                    logger.error("Non-retryable error occurred, raising immediately")
                    raise e

        # All retries exhausted
        logger.error(f"All retry attempts exhausted after {self.config.max_retries + 1} tries")
        raise last_exception


class ConnectionPoolManager:
    """HTTP connection pool manager with resilience features"""

    def __init__(self, config: NetworkResilienceConfig):
        self.config = config
        self._session: Optional[aiohttp.ClientSession] = None
        self._lock = asyncio.Lock()

    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session with connection pooling"""
        if self._session is None or self._session.closed:
            async with self._lock:
                if self._session is None or self._session.closed:
                    connector = aiohttp.TCPConnector(
                        limit=self.config.connection_pool_size,
                        limit_per_host=self.config.connection_pool_size // 2,
                        ttl_dns_cache=300,
                        use_dns_cache=True,
                        keepalive_timeout=30,
                        enable_cleanup_closed=True
                    )

                    timeout = aiohttp.ClientTimeout(
                        total=self.config.timeout,
                        connect=self.config.timeout / 2,
                        sock_read=self.config.timeout / 2
                    )

                    self._session = aiohttp.ClientSession(
                        connector=connector,
                        timeout=timeout,
                        headers={
                            'User-Agent': 'UITrace-Server/1.0.0',
                            'Accept': 'application/json',
                            'Connection': 'keep-alive'
                        }
                    )

                    logger.info("Created new HTTP session with connection pooling")

        return self._session

    async def close(self):
        """Close HTTP session and cleanup resources"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("Closed HTTP session")


class NetworkResilienceService:
    """Main network resilience service"""

    def __init__(self, config: Optional[NetworkResilienceConfig] = None):
        self.config = config or NetworkResilienceConfig()
        self.retry_handler = RetryHandler(self.config)
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.connection_pool = ConnectionPoolManager(self.config)
        self._health_check_tasks: Dict[str, asyncio.Task] = {}

    def get_circuit_breaker(self, name: str) -> CircuitBreaker:
        """Get or create circuit breaker for specific service"""
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker(
                threshold=self.config.circuit_breaker_threshold,
                timeout=self.config.circuit_breaker_timeout
            )
        return self.circuit_breakers[name]

    async def make_request_with_resilience(
        self,
        method: str,
        url: str,
        circuit_breaker_name: Optional[str] = None,
        **kwargs
    ) -> aiohttp.ClientResponse:
        """Make HTTP request with full resilience features"""

        async def _make_request():
            session = await self.connection_pool.get_session()

            try:
                async with session.request(method, url, **kwargs) as response:
                    # Read response content to handle potential connection issues
                    await response.read()

                    if response.status >= 500:
                        # Server errors should trigger retries
                        raise ServerTimeoutError(f"Server error {response.status}")

                    return response

            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                logger.warning(f"HTTP request failed: {str(e)}")
                raise e

        # Apply circuit breaker if specified
        if circuit_breaker_name:
            circuit_breaker = self.get_circuit_breaker(circuit_breaker_name)
            return await circuit_breaker.call(_make_request)
        else:
            return await self.retry_handler.execute_with_retry(_make_request)

    async def health_check(
        self,
        name: str,
        url: str,
        interval: float = 30.0,
        timeout: float = 10.0
    ):
        """Start periodic health check for a service"""

        async def _health_check():
            while True:
                try:
                    session = await self.connection_pool.get_session()
                    async with session.get(url, timeout=timeout) as response:
                        if response.status == 200:
                            logger.info(f"Health check passed for {name}")
                            # Reset circuit breaker on successful health check
                            if name in self.circuit_breakers:
                                self.circuit_breakers[name].reset()
                        else:
                            logger.warning(f"Health check failed for {name}: {response.status}")

                except Exception as e:
                    logger.error(f"Health check error for {name}: {str(e)}")

                await asyncio.sleep(interval)

        # Cancel existing health check if any
        if name in self._health_check_tasks:
            self._health_check_tasks[name].cancel()

        # Start new health check task
        task = asyncio.create_task(_health_check())
        self._health_check_tasks[name] = task
        logger.info(f"Started health check for {name} every {interval}s")

    def stop_health_check(self, name: str):
        """Stop health check for a service"""
        if name in self._health_check_tasks:
            self._health_check_tasks[name].cancel()
            del self._health_check_tasks[name]
            logger.info(f"Stopped health check for {name}")

    async def cleanup(self):
        """Cleanup all resources"""
        # Cancel all health check tasks
        for task in self._health_check_tasks.values():
            task.cancel()

        # Wait for tasks to complete
        if self._health_check_tasks:
            await asyncio.gather(*self._health_check_tasks.values(), return_exceptions=True)

        # Close connection pool
        await self.connection_pool.close()

        logger.info("Network resilience service cleanup completed")


# Decorator for adding network resilience to functions
def with_network_resilience(
    circuit_breaker_name: Optional[str] = None,
    config: Optional[NetworkResilienceConfig] = None
):
    """Decorator to add network resilience to async functions"""

    def decorator(func: Callable) -> Callable:
        service = NetworkResilienceService(config)

        @wraps(func)
        async def wrapper(*args, **kwargs):
            if circuit_breaker_name:
                circuit_breaker = service.get_circuit_breaker(circuit_breaker_name)
                return await circuit_breaker.call(func, *args, **kwargs)
            else:
                return await service.retry_handler.execute_with_retry(func, *args, **kwargs)

        return wrapper

    return decorator


# Global service instance
_network_resilience_service: Optional[NetworkResilienceService] = None


def get_network_resilience_service() -> NetworkResilienceService:
    """Get global network resilience service instance"""
    global _network_resilience_service
    if _network_resilience_service is None:
        _network_resilience_service = NetworkResilienceService()
    return _network_resilience_service


async def init_network_resilience_service(config: Optional[NetworkResilienceConfig] = None):
    """Initialize global network resilience service"""
    global _network_resilience_service
    _network_resilience_service = NetworkResilienceService(config)
    logger.info("Network resilience service initialized")


async def cleanup_network_resilience_service():
    """Cleanup global network resilience service"""
    global _network_resilience_service
    if _network_resilience_service:
        await _network_resilience_service.cleanup()
        _network_resilience_service = None
        logger.info("Network resilience service cleaned up")