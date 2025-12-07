"""
Browser automation service with network resilience for WebDriver connections
"""

import asyncio
import json
import base64
import tempfile
from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.common.exceptions import (
    WebDriverException, TimeoutException, NoSuchElementException,
    StaleElementReferenceException, ElementNotInteractableException
)
from selenium.webdriver.remote.remote_connection import RemoteConnection

from .network_resilience import (
    NetworkResilienceService, NetworkResilienceConfig,
    with_network_resilience, get_network_resilience_service
)
from ..core.config import settings

logger = structlog.get_logger()


class BrowserAutomationConfig:
    """Configuration for browser automation"""

    def __init__(
        self,
        selenium_hub_url: str = None,
        browser_timeout: int = None,
        max_concurrent_sessions: int = None,
        screenshot_format: str = None,
        window_size: tuple = (1920, 1080),
        headless: bool = True,
        enable_logging: bool = True
    ):
        self.selenium_hub_url = selenium_hub_url or settings.SELENIUM_HUB_URL
        self.browser_timeout = browser_timeout or settings.BROWSER_TIMEOUT_SECONDS
        self.max_concurrent_sessions = max_concurrent_sessions or settings.MAX_CONCURRENT_EXECUTIONS
        self.screenshot_format = screenshot_format or settings.SCREENSHOT_FORMAT
        self.window_size = window_size
        self.headless = headless
        self.enable_logging = enable_logging


class BrowserSession:
    """Represents a browser session with resilience features"""

    def __init__(
        self,
        session_id: str,
        driver: WebDriver,
        config: BrowserAutomationConfig,
        resilience_service: NetworkResilienceService
    ):
        self.session_id = session_id
        self.driver = driver
        self.config = config
        self.resilience_service = resilience_service
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.is_active = True
        self._lock = asyncio.Lock()

    async def navigate_to(self, url: str, timeout: Optional[int] = None) -> bool:
        """Navigate to URL with resilience"""
        timeout = timeout or self.config.browser_timeout

        async def _navigate():
            try:
                self.driver.get(url)
                # Wait for page to load
                WebDriverWait(self.driver, timeout).until(
                    lambda driver: driver.execute_script("return document.readyState") == "complete"
                )
                self.last_activity = datetime.now()
                logger.info(f"Successfully navigated to {url}")
                return True
            except TimeoutException:
                logger.error(f"Timeout navigating to {url}")
                raise
            except WebDriverException as e:
                logger.error(f"WebDriver error navigating to {url}: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_navigate)

    async def find_element(self, selector: str, selector_type: str = "css", timeout: Optional[int] = None):
        """Find element with resilience"""
        timeout = timeout or self.config.browser_timeout
        by_type = self._get_by_type(selector_type)

        async def _find_element():
            try:
                element = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((by_type, selector))
                )
                self.last_activity = datetime.now()
                return element
            except TimeoutException:
                logger.error(f"Element not found: {selector_type}={selector}")
                raise
            except WebDriverException as e:
                logger.error(f"WebDriver error finding element: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_find_element)

    async def click_element(self, selector: str, selector_type: str = "css", timeout: Optional[int] = None) -> bool:
        """Click element with resilience"""
        timeout = timeout or self.config.browser_timeout
        by_type = self._get_by_type(selector_type)

        async def _click_element():
            try:
                element = WebDriverWait(self.driver, timeout).until(
                    EC.element_to_be_clickable((by_type, selector))
                )
                element.click()
                self.last_activity = datetime.now()
                logger.info(f"Successfully clicked element: {selector_type}={selector}")
                return True
            except TimeoutException:
                logger.error(f"Element not clickable: {selector_type}={selector}")
                raise
            except (ElementNotInteractableException, WebDriverException) as e:
                logger.error(f"Error clicking element: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_click_element)

    async def send_keys(self, selector: str, text: str, selector_type: str = "css", timeout: Optional[int] = None) -> bool:
        """Send keys to element with resilience"""
        timeout = timeout or self.config.browser_timeout
        by_type = self._get_by_type(selector_type)

        async def _send_keys():
            try:
                element = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((by_type, selector))
                )
                element.clear()
                element.send_keys(text)
                self.last_activity = datetime.now()
                logger.info(f"Successfully sent keys to element: {selector_type}={selector}")
                return True
            except TimeoutException:
                logger.error(f"Element not found for sending keys: {selector_type}={selector}")
                raise
            except WebDriverException as e:
                logger.error(f"Error sending keys to element: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_send_keys)

    async def take_screenshot(self, filename: Optional[str] = None) -> str:
        """Take screenshot with resilience"""
        async def _take_screenshot():
            try:
                if filename:
                    self.driver.save_screenshot(filename)
                    return filename
                else:
                    # Return base64 encoded screenshot
                    screenshot = self.driver.get_screenshot_as_base64()
                    return screenshot
            except WebDriverException as e:
                logger.error(f"Error taking screenshot: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_take_screenshot)

    async def execute_script(self, script: str, *args) -> Any:
        """Execute JavaScript with resilience"""
        async def _execute_script():
            try:
                result = self.driver.execute_script(script, *args)
                self.last_activity = datetime.now()
                return result
            except WebDriverException as e:
                logger.error(f"Error executing script: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_execute_script)

    async def wait_for_element(self, selector: str, selector_type: str = "css", timeout: Optional[int] = None):
        """Wait for element to appear with resilience"""
        timeout = timeout or self.config.browser_timeout
        by_type = self._get_by_type(selector_type)

        async def _wait_for_element():
            try:
                element = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((by_type, selector))
                )
                self.last_activity = datetime.now()
                return element
            except TimeoutException:
                logger.error(f"Element not found within timeout: {selector_type}={selector}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_wait_for_element)

    async def get_page_source(self) -> str:
        """Get page source with resilience"""
        async def _get_page_source():
            try:
                source = self.driver.page_source
                self.last_activity = datetime.now()
                return source
            except WebDriverException as e:
                logger.error(f"Error getting page source: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_get_page_source)

    async def get_current_url(self) -> str:
        """Get current URL with resilience"""
        async def _get_current_url():
            try:
                url = self.driver.current_url
                self.last_activity = datetime.now()
                return url
            except WebDriverException as e:
                logger.error(f"Error getting current URL: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_get_current_url)

    async def close(self):
        """Close browser session"""
        async with self._lock:
            if self.is_active and self.driver:
                try:
                    self.driver.quit()
                    self.is_active = False
                    logger.info(f"Browser session {self.session_id} closed")
                except Exception as e:
                    logger.error(f"Error closing browser session {self.session_id}: {str(e)}")

    def _get_by_type(self, selector_type: str):
        """Convert selector type to Selenium By type"""
        selector_type = selector_type.lower()
        by_types = {
            "css": By.CSS_SELECTOR,
            "id": By.ID,
            "class": By.CLASS_NAME,
            "name": By.NAME,
            "tag": By.TAG_NAME,
            "xpath": By.XPATH,
            "link_text": By.LINK_TEXT,
            "partial_link_text": By.PARTIAL_LINK_TEXT
        }
        return by_types.get(selector_type, By.CSS_SELECTOR)

    @property
    def session_duration(self) -> float:
        """Get session duration in seconds"""
        return (datetime.now() - self.created_at).total_seconds()

    @property
    def idle_time(self) -> float:
        """Get idle time in seconds"""
        return (datetime.now() - self.last_activity).total_seconds()


class BrowserAutomationService:
    """Main browser automation service with network resilience"""

    def __init__(self, config: Optional[BrowserAutomationConfig] = None):
        self.config = config or BrowserAutomationConfig()
        self.resilience_service = get_network_resilience_service()
        self._sessions: Dict[str, BrowserSession] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None

    async def create_session(
        self,
        session_id: str,
        browser_type: str = "chrome",
        capabilities: Optional[Dict[str, Any]] = None
    ) -> BrowserSession:
        """Create new browser session with resilience"""

        async def _create_session():
            try:
                driver = await self._create_webdriver(browser_type, capabilities)

                session = BrowserSession(
                    session_id=session_id,
                    driver=driver,
                    config=self.config,
                    resilience_service=self.resilience_service
                )

                async with self._lock:
                    self._sessions[session_id] = session

                logger.info(f"Browser session {session_id} created successfully")
                return session

            except WebDriverException as e:
                logger.error(f"Failed to create browser session {session_id}: {str(e)}")
                raise

        return await self.resilience_service.retry_handler.execute_with_retry(_create_session)

    async def get_session(self, session_id: str) -> Optional[BrowserSession]:
        """Get existing browser session"""
        async with self._lock:
            return self._sessions.get(session_id)

    async def close_session(self, session_id: str) -> bool:
        """Close browser session"""
        async with self._lock:
            session = self._sessions.get(session_id)
            if session:
                await session.close()
                del self._sessions[session_id]
                logger.info(f"Browser session {session_id} removed")
                return True
            return False

    async def close_all_sessions(self):
        """Close all browser sessions"""
        async with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()

        # Close all sessions concurrently
        await asyncio.gather(
            *[session.close() for session in sessions],
            return_exceptions=True
        )

        logger.info(f"Closed {len(sessions)} browser sessions")

    async def cleanup_idle_sessions(self, max_idle_time: float = 300.0):
        """Cleanup idle browser sessions"""
        async with self._lock:
            idle_sessions = [
                session_id for session_id, session in self._sessions.items()
                if session.idle_time > max_idle_time
            ]

        # Close idle sessions
        for session_id in idle_sessions:
            await self.close_session(session_id)

        if idle_sessions:
            logger.info(f"Cleaned up {len(idle_sessions)} idle browser sessions")

    async def start_cleanup_task(self, interval: float = 60.0, max_idle_time: float = 300.0):
        """Start periodic cleanup task"""
        async def _cleanup_task():
            while True:
                try:
                    await self.cleanup_idle_sessions(max_idle_time)
                except Exception as e:
                    logger.error(f"Error in cleanup task: {str(e)}")

                await asyncio.sleep(interval)

        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(_cleanup_task())
            logger.info("Started browser session cleanup task")

    def stop_cleanup_task(self):
        """Stop cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None
            logger.info("Stopped browser session cleanup task")

    async def _create_webdriver(self, browser_type: str, capabilities: Optional[Dict[str, Any]] = None) -> WebDriver:
        """Create WebDriver instance with resilience"""
        capabilities = capabilities or {}

        if browser_type.lower() == "chrome":
            return await self._create_chrome_driver(capabilities)
        elif browser_type.lower() == "firefox":
            return await self._create_firefox_driver(capabilities)
        else:
            raise ValueError(f"Unsupported browser type: {browser_type}")

    async def _create_chrome_driver(self, capabilities: Dict[str, Any]) -> WebDriver:
        """Create Chrome WebDriver"""
        options = ChromeOptions()

        if self.config.headless:
            options.add_argument("--headless=new")

        options.add_argument(f"--window-size={self.config.window_size[0]},{self.config.window_size[1]}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--disable-images")
        options.add_argument("--disable-javascript")  # Enable JS when needed

        # Additional capabilities
        for key, value in capabilities.items():
            if key.startswith("goog:"):
                options.set_capability(key, value)

        if self.config.selenium_hub_url and self.config.selenium_hub_url != "local":
            # Remote WebDriver
            driver = webdriver.Remote(
                command_executor=self.config.selenium_hub_url,
                options=options
            )
        else:
            # Local WebDriver
            driver = webdriver.Chrome(options=options)

        return driver

    async def _create_firefox_driver(self, capabilities: Dict[str, Any]) -> WebDriver:
        """Create Firefox WebDriver"""
        options = FirefoxOptions()

        if self.config.headless:
            options.add_argument("--headless")

        options.add_argument(f"--width={self.config.window_size[0]}")
        options.add_argument(f"--height={self.config.window_size[1]}")

        # Additional capabilities
        for key, value in capabilities.items():
            if key.startswith("moz:"):
                options.set_capability(key, value)

        if self.config.selenium_hub_url and self.config.selenium_hub_url != "local":
            # Remote WebDriver
            driver = webdriver.Remote(
                command_executor=self.config.selenium_hub_url,
                options=options
            )
        else:
            # Local WebDriver
            driver = webdriver.Firefox(options=options)

        return driver

    @property
    def active_sessions_count(self) -> int:
        """Get number of active sessions"""
        return len(self._sessions)

    @property
    def session_ids(self) -> List[str]:
        """Get all session IDs"""
        return list(self._sessions.keys())


# Global service instance
_browser_automation_service: Optional[BrowserAutomationService] = None


async def get_browser_automation_service() -> BrowserAutomationService:
    """Get global browser automation service instance"""
    global _browser_automation_service
    if _browser_automation_service is None:
        _browser_automation_service = BrowserAutomationService()
    return _browser_automation_service


async def init_browser_automation_service(config: Optional[BrowserAutomationConfig] = None):
    """Initialize global browser automation service"""
    global _browser_automation_service
    _browser_automation_service = BrowserAutomationService(config)
    await _browser_automation_service.start_cleanup_task()
    logger.info("Browser automation service initialized")


async def cleanup_browser_automation_service():
    """Cleanup global browser automation service"""
    global _browser_automation_service
    if _browser_automation_service:
        _browser_automation_service.stop_cleanup_task()
        await _browser_automation_service.close_all_sessions()
        _browser_automation_service = None
        logger.info("Browser automation service cleaned up")