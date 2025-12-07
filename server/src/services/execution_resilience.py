"""
Execution resilience service that integrates network resilience with script execution
"""

import asyncio
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from .network_resilience import (
    NetworkResilienceService, NetworkResilienceConfig,
    get_network_resilience_service, with_network_resilience
)
from .browser_automation import (
    BrowserAutomationService, BrowserAutomationConfig,
    BrowserSession, get_browser_automation_service
)
from .cdp_service import (
    CDPService, get_cdp_service
)
from .script_service import ScriptService
from ..models.execution import TestExecution, TestStepResult
from ..models.script import Script
from ..core.config import settings

logger = structlog.get_logger()


class ExecutionResilienceConfig:
    """Configuration for execution resilience"""

    def __init__(
        self,
        max_execution_retries: int = 3,
        execution_timeout: float = 300.0,
        step_timeout: float = 30.0,
        recovery_delay: float = 5.0,
        browser_health_check_interval: float = 30.0,
        connection_health_check_interval: float = 30.0,
        max_concurrent_executions: int = 10,
        enable_cdp_monitoring: bool = True,
        enable_network_monitoring: bool = True
    ):
        self.max_execution_retries = max_execution_retries
        self.execution_timeout = execution_timeout
        self.step_timeout = step_timeout
        self.recovery_delay = recovery_delay
        self.browser_health_check_interval = browser_health_check_interval
        self.connection_health_check_interval = connection_health_check_interval
        self.max_concurrent_executions = max_concurrent_executions
        self.enable_cdp_monitoring = enable_cdp_monitoring
        self.enable_network_monitoring = enable_network_monitoring


class ExecutionContext:
    """Context for resilient script execution"""

    def __init__(
        self,
        execution_id: str,
        script_id: str,
        session: BrowserSession,
        cdp_connection: Optional[Any] = None,
        config: Optional[ExecutionResilienceConfig] = None
    ):
        self.execution_id = execution_id
        self.script_id = script_id
        self.session = session
        self.cdp_connection = cdp_connection
        self.config = config or ExecutionResilienceConfig()
        self.start_time = datetime.now()
        self.current_step = 0
        self.total_steps = 0
        self.errors: List[Dict[str, Any]] = []
        self.recovery_attempts = 0
        self.is_recovering = False
        self.network_events: List[Dict[str, Any]] = []
        self.console_events: List[Dict[str, Any]] = []

    @property
    def execution_duration(self) -> float:
        """Get execution duration in seconds"""
        return (datetime.now() - self.start_time).total_seconds()

    @property
    def session_health(self) -> Dict[str, Any]:
        """Get session health status"""
        return {
            "session_id": self.session.session_id,
            "is_active": self.session.is_active,
            "session_duration": self.session.session_duration,
            "idle_time": self.session.idle_time,
            "execution_duration": self.execution_duration,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "recovery_attempts": self.recovery_attempts,
            "is_recovering": self.is_recovering,
            "error_count": len(self.errors)
        }


class ExecutionResilienceService:
    """Service that provides resilient script execution with network recovery"""

    def __init__(self, config: Optional[ExecutionResilienceConfig] = None):
        self.config = config or ExecutionResilienceConfig()
        self.network_service = get_network_resilience_service()
        self.browser_service = get_browser_automation_service()
        self.cdp_service = get_cdp_service()
        self.script_service = ScriptService()
        self._active_contexts: Dict[str, ExecutionContext] = {}
        self._health_check_tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None

    async def create_resilient_execution(
        self,
        execution_id: str,
        script_id: str,
        browser_type: str = "chrome",
        enable_cdp: bool = True
    ) -> Optional[ExecutionContext]:
        """Create a resilient execution context"""
        try:
            # Create browser session with resilience
            session = await self.browser_service.create_session(
                session_id=f"exec_{execution_id}",
                browser_type=browser_type
            )

            if not session:
                logger.error(f"Failed to create browser session for execution {execution_id}")
                return None

            # Setup CDP monitoring if enabled
            cdp_connection = None
            if enable_cdp and self.config.enable_cdp_monitoring:
                # Get debugger URL from browser session
                debugger_url = await self._get_debugger_url(session)
                if debugger_url:
                    cdp_connection = await self.cdp_service.connect_to_browser(
                        debugger_url=debugger_url,
                        connection_id=f"cdp_{execution_id}"
                    )

                    if cdp_connection:
                        # Enable monitoring domains
                        await self.cdp_service.enable_domain(cdp_connection.connection_id, "Network")
                        await self.cdp_service.enable_domain(cdp_connection.connection_id, "Runtime")
                        await self.cdp_service.enable_domain(cdp_connection.connection_id, "DOM")

                        # Start periodic monitoring
                        await self.cdp_service.start_periodic_monitoring(
                            cdp_connection.connection_id,
                            interval=self.config.connection_health_check_interval
                        )

            # Create execution context
            context = ExecutionContext(
                execution_id=execution_id,
                script_id=script_id,
                session=session,
                cdp_connection=cdp_connection,
                config=self.config
            )

            async with self._lock:
                self._active_contexts[execution_id] = context

            # Start health monitoring
            await self._start_execution_health_monitoring(execution_id)

            logger.info(f"Created resilient execution context: {execution_id}")
            return context

        except Exception as e:
            logger.error(f"Failed to create resilient execution context: {str(e)}")
            return None

    async def execute_script_with_resilience(
        self,
        execution_id: str,
        session: AsyncSession,
        script_content: Dict[str, Any]
    ) -> bool:
        """Execute script with full resilience features"""
        context = self._active_contexts.get(execution_id)
        if not context:
            logger.error(f"Execution context not found: {execution_id}")
            return False

        try:
            steps = script_content.get("steps", [])
            context.total_steps = len(steps)

            for step_index, step in enumerate(steps):
                context.current_step = step_index + 1
                success = await self._execute_step_with_resilience(context, step, session)

                if not success:
                    logger.error(f"Step {context.current_step} failed, attempting recovery...")
                    recovery_success = await self._attempt_recovery(context, step, session)

                    if not recovery_success:
                        logger.error(f"Recovery failed for step {context.current_step}")
                        return False

                    logger.info(f"Recovery successful for step {context.current_step}")

            logger.info(f"Script execution completed successfully: {execution_id}")
            return True

        except Exception as e:
            logger.error(f"Script execution failed: {str(e)}")
            return False

    async def _execute_step_with_resilience(
        self,
        context: ExecutionContext,
        step: Dict[str, Any],
        session: AsyncSession
    ) -> bool:
        """Execute individual step with resilience"""
        step_type = step.get("type", "")
        step_id = step.get("id", context.current_step)

        try:
            # Check session health before execution
            if not await self._check_session_health(context):
                logger.warning(f"Session health check failed for step {step_id}")
                return False

            # Execute step based on type
            if step_type == "navigate":
                return await self._execute_navigate_step(context, step)
            elif step_type == "click":
                return await self._execute_click_step(context, step)
            elif step_type == "input":
                return await self._execute_input_step(context, step)
            elif step_type == "screenshot":
                return await self._execute_screenshot_step(context, step)
            elif step_type == "wait":
                return await self._execute_wait_step(context, step)
            else:
                logger.warning(f"Unknown step type: {step_type}")
                return True  # Skip unknown steps

        except Exception as e:
            logger.error(f"Step execution failed: {str(e)}")
            await self._record_step_error(context, step_id, str(e), session)
            return False

    async def _execute_navigate_step(self, context: ExecutionContext, step: Dict[str, Any]) -> bool:
        """Execute navigate step"""
        url = step.get("url", "")
        if not url:
            return False

        return await context.session.navigate_to(url, timeout=self.config.step_timeout)

    async def _execute_click_step(self, context: ExecutionContext, step: Dict[str, Any]) -> bool:
        """Execute click step"""
        selector = step.get("selector", "")
        selector_type = step.get("selector_type", "css")

        if not selector:
            return False

        return await context.session.click_element(selector, selector_type, timeout=self.config.step_timeout)

    async def _execute_input_step(self, context: ExecutionContext, step: Dict[str, Any]) -> bool:
        """Execute input step"""
        selector = step.get("selector", "")
        selector_type = step.get("selector_type", "css")
        text = step.get("text", "")

        if not selector or text is None:
            return False

        return await context.session.send_keys(selector, text, selector_type, timeout=self.config.step_timeout)

    async def _execute_screenshot_step(self, context: ExecutionContext, step: Dict[str, Any]) -> bool:
        """Execute screenshot step"""
        filename = step.get("filename")

        try:
            screenshot_data = await context.session.take_screenshot(filename)
            if screenshot_data:
                logger.info(f"Screenshot captured: {len(screenshot_data) if isinstance(screenshot_data, str) else 'saved to file'}")
                return True
            return False
        except Exception as e:
            logger.error(f"Screenshot step failed: {str(e)}")
            return False

    async def _execute_wait_step(self, context: ExecutionContext, step: Dict[str, Any]) -> bool:
        """Execute wait step"""
        wait_time = step.get("duration", 1.0)

        try:
            await asyncio.sleep(wait_time)
            return True
        except Exception as e:
            logger.error(f"Wait step failed: {str(e)}")
            return False

    async def _attempt_recovery(self, context: ExecutionContext, step: Dict[str, Any], session: AsyncSession) -> bool:
        """Attempt to recover from execution failure"""
        if context.recovery_attempts >= self.config.max_execution_retries:
            logger.error(f"Maximum recovery attempts reached: {context.recovery_attempts}")
            return False

        context.recovery_attempts += 1
        context.is_recovering = True

        logger.info(f"Attempting recovery (attempt {context.recovery_attempts}/{self.config.max_execution_retries})")

        try:
            # Wait for recovery delay
            await asyncio.sleep(self.config.recovery_delay)

            # Check if session is still healthy
            if await self._check_session_health(context):
                logger.info("Session is healthy, retrying step...")
                context.is_recovering = False
                return await self._execute_step_with_resilience(context, step, session)

            # Try to recover browser session
            logger.info("Attempting to recover browser session...")
            session_recovery_success = await self._recover_browser_session(context)

            if session_recovery_success:
                logger.info("Browser session recovered, retrying step...")
                context.is_recovering = False
                return await self._execute_step_with_resilience(context, step, session)

            # If session recovery failed, try to create new session
            logger.info("Creating new browser session for recovery...")
            new_context = await self.create_resilient_execution(
                execution_id=context.execution_id,
                script_id=context.script_id
            )

            if new_context:
                logger.info("New execution context created for recovery")
                context.is_recovering = False
                return await self._execute_step_with_resilience(new_context, step, session)

            logger.error("All recovery attempts failed")
            return False

        except Exception as e:
            logger.error(f"Recovery attempt failed: {str(e)}")
            return False
        finally:
            context.is_recovering = False

    async def _check_session_health(self, context: ExecutionContext) -> bool:
        """Check if browser session is healthy"""
        try:
            # Check if session is active
            if not context.session.is_active:
                return False

            # Check idle time
            if context.session.idle_time > 300:  # 5 minutes
                logger.warning(f"Session idle for too long: {context.session.idle_time}s")
                return False

            # Try to get current URL as health check
            current_url = await context.session.get_current_url()
            if current_url is None:
                return False

            return True

        except Exception as e:
            logger.error(f"Session health check failed: {str(e)}")
            return False

    async def _recover_browser_session(self, context: ExecutionContext) -> bool:
        """Attempt to recover browser session"""
        try:
            # Close current session
            await context.session.close()

            # Create new session with same ID
            new_session = await self.browser_service.create_session(
                session_id=context.session.session_id,
                browser_type="chrome"  # Default to chrome for recovery
            )

            if new_session:
                context.session = new_session
                logger.info(f"Browser session recovered: {context.session.session_id}")
                return True

            return False

        except Exception as e:
            logger.error(f"Browser session recovery failed: {str(e)}")
            return False

    async def _record_step_error(self, context: ExecutionContext, step_id: Any, error_message: str, session: AsyncSession):
        """Record step error in database"""
        try:
            error_record = {
                "step_id": step_id,
                "error_message": error_message,
                "timestamp": datetime.now().isoformat(),
                "execution_id": context.execution_id
            }
            context.errors.append(error_record)

            # Update execution record with error
            execution = await session.get(TestExecution, context.execution_id)
            if execution:
                execution.error_message = error_message
                execution.status = "failed"
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to record step error: {str(e)}")

    async def _get_debugger_url(self, session: BrowserSession) -> Optional[str]:
        """Get debugger URL from browser session"""
        try:
            # Execute script to get debugger URL
            debugger_url = await session.execute_script("""
                // Get Chrome DevTools debugger URL
                if (window.chrome && window.chrome.runtime) {
                    return window.location.protocol + "//" + window.location.host;
                }
                return window.location.origin;
            """)
            return debugger_url
        except Exception as e:
            logger.error(f"Failed to get debugger URL: {str(e)}")
            return None

    async def _start_execution_health_monitoring(self, execution_id: str):
        """Start health monitoring for execution"""
        async def _monitor_health():
            while True:
                try:
                    context = self._active_contexts.get(execution_id)
                    if not context:
                        break

                    # Check session health
                    health_status = context.session_health
                    logger.debug(f"Execution health check: {health_status}")

                    # If session is unhealthy, attempt recovery
                    if not await self._check_session_health(context):
                        logger.warning(f"Unhealthy execution detected: {execution_id}")
                        # Recovery will be handled by the execution logic

                    await asyncio.sleep(self.config.browser_health_check_interval)

                except Exception as e:
                    logger.error(f"Health monitoring error for {execution_id}: {str(e)}")
                    await asyncio.sleep(self.config.browser_health_check_interval)

        # Stop existing monitoring if any
        self._stop_execution_health_monitoring(execution_id)

        # Start new monitoring task
        task = asyncio.create_task(_monitor_health())
        self._health_check_tasks[execution_id] = task
        logger.info(f"Started health monitoring for execution: {execution_id}")

    def _stop_execution_health_monitoring(self, execution_id: str):
        """Stop health monitoring for execution"""
        if execution_id in self._health_check_tasks:
            self._health_check_tasks[execution_id].cancel()
            del self._health_check_tasks[execution_id]
            logger.info(f"Stopped health monitoring for execution: {execution_id}")

    async def cleanup_execution(self, execution_id: str) -> bool:
        """Cleanup execution context and resources"""
        context = self._active_contexts.get(execution_id)
        if not context:
            return False

        try:
            # Stop health monitoring
            self._stop_execution_health_monitoring(execution_id)

            # Close CDP connection if exists
            if context.cdp_connection:
                await self.cdp_service.disconnect_from_browser(context.cdp_connection.connection_id)

            # Close browser session
            await self.browser_service.close_session(context.session.session_id)

            # Remove from active contexts
            async with self._lock:
                del self._active_contexts[execution_id]

            logger.info(f"Execution cleanup completed: {execution_id}")
            return True

        except Exception as e:
            logger.error(f"Execution cleanup failed: {str(e)}")
            return False

    async def start_cleanup_task(self, interval: float = 60.0, max_idle_time: float = 600.0):
        """Start periodic cleanup of idle executions"""
        async def _cleanup_task():
            while True:
                try:
                    # Find idle executions
                    idle_executions = []
                    async with self._lock:
                        for execution_id, context in self._active_contexts.items():
                            if context.session.idle_time > max_idle_time:
                                idle_executions.append(execution_id)

                    # Cleanup idle executions
                    for execution_id in idle_executions:
                        await self.cleanup_execution(execution_id)

                    if idle_executions:
                        logger.info(f"Cleaned up {len(idle_executions)} idle executions")

                except Exception as e:
                    logger.error(f"Error in execution cleanup task: {str(e)}")

                await asyncio.sleep(interval)

        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(_cleanup_task())
            logger.info("Started execution cleanup task")

    def stop_cleanup_task(self):
        """Stop cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None
            logger.info("Stopped execution cleanup task")

    async def cleanup_all_executions(self):
        """Cleanup all active executions"""
        async with self._lock:
            execution_ids = list(self._active_contexts.keys())

        # Cleanup all executions concurrently
        results = await asyncio.gather(
            *[self.cleanup_execution(execution_id) for execution_id in execution_ids],
            return_exceptions=True
        )

        successful_cleanups = sum(1 for result in results if result is True)
        logger.info(f"Cleaned up {successful_cleanups}/{len(execution_ids)} executions")

    @property
    def active_executions(self) -> List[str]:
        """Get list of active execution IDs"""
        return list(self._active_contexts.keys())

    @property
    def executions_count(self) -> int:
        """Get number of active executions"""
        return len(self._active_contexts)

    def get_execution_health(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get execution health status"""
        context = self._active_contexts.get(execution_id)
        return context.session_health if context else None


# Global service instance
_execution_resilience_service: Optional[ExecutionResilienceService] = None


async def get_execution_resilience_service() -> ExecutionResilienceService:
    """Get global execution resilience service instance"""
    global _execution_resilience_service
    if _execution_resilience_service is None:
        _execution_resilience_service = ExecutionResilienceService()
    return _execution_resilience_service


async def init_execution_resilience_service(config: Optional[ExecutionResilienceConfig] = None):
    """Initialize global execution resilience service"""
    global _execution_resilience_service
    _execution_resilience_service = ExecutionResilienceService(config)
    await _execution_resilience_service.start_cleanup_task()
    logger.info("Execution resilience service initialized")


async def cleanup_execution_resilience_service():
    """Cleanup global execution resilience service"""
    global _execution_resilience_service
    if _execution_resilience_service:
        _execution_resilience_service.stop_cleanup_task()
        await _execution_resilience_service.cleanup_all_executions()
        _execution_resilience_service = None
        logger.info("Execution resilience service cleaned up")