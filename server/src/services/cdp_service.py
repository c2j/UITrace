"""
Chrome DevTools Protocol service with network resilience for browser monitoring
"""

import asyncio
import json
import base64
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
import structlog
import websockets
from websockets.exceptions import ConnectionClosed, WebSocketException
import aiohttp

from .network_resilience import (
    NetworkResilienceService, NetworkResilienceConfig,
    get_network_resilience_service
)

logger = structlog.get_logger()


class CDPMessage:
    """Represents a Chrome DevTools Protocol message"""

    def __init__(self, method: str, params: Optional[Dict[str, Any]] = None, id: Optional[int] = None):
        self.method = method
        self.params = params or {}
        self.id = id
        self.timestamp = datetime.now()

    def to_json(self) -> str:
        """Convert to JSON string"""
        message = {
            "method": self.method,
            "params": self.params
        }
        if self.id is not None:
            message["id"] = self.id
        return json.dumps(message)


class CDPResponse:
    """Represents a Chrome DevTools Protocol response"""

    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id")
        self.method = data.get("method")
        self.params = data.get("params", {})
        self.result = data.get("result", {})
        self.error = data.get("error", {})
        self.timestamp = datetime.now()

    @property
    def is_error(self) -> bool:
        """Check if response is an error"""
        return bool(self.error)

    @property
    def error_message(self) -> str:
        """Get error message"""
        return self.error.get("message", "Unknown error") if self.error else ""


class CDPConnection:
    """Manages a Chrome DevTools Protocol connection"""

    def __init__(
        self,
        websocket_url: str,
        resilience_service: NetworkResilienceService,
        connection_id: str
    ):
        self.websocket_url = websocket_url
        self.resilience_service = resilience_service
        self.connection_id = connection_id
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.message_id = 0
        self.pending_requests: Dict[int, asyncio.Future] = {}
        self.event_handlers: Dict[str, List[Callable]] = {}
        self._connection_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def connect(self, timeout: float = 30.0) -> bool:
        """Connect to Chrome DevTools Protocol"""
        try:
            self.websocket = await websockets.connect(
                self.websocket_url,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=10
            )
            self.is_connected = True
            self._connection_task = asyncio.create_task(self._message_loop())
            logger.info(f"CDP connection {self.connection_id} established")
            return True

        except Exception as e:
            logger.error(f"Failed to establish CDP connection {self.connection_id}: {str(e)}")
            self.is_connected = False
            return False

    async def disconnect(self):
        """Disconnect from Chrome DevTools Protocol"""
        async with self._lock:
            self.is_connected = False

            if self._connection_task:
                self._connection_task.cancel()
                try:
                    await self._connection_task
                except asyncio.CancelledError:
                    pass
                self._connection_task = None

            if self.websocket:
                await self.websocket.close()
                self.websocket = None

            # Cancel all pending requests
            for future in self.pending_requests.values():
                if not future.done():
                    future.cancel()
            self.pending_requests.clear()

            logger.info(f"CDP connection {self.connection_id} disconnected")

    async def send_command(self, method: str, params: Optional[Dict[str, Any]] = None, timeout: float = 30.0) -> CDPResponse:
        """Send command and wait for response"""
        if not self.is_connected:
            raise Exception("CDP connection is not established")

        async def _send_command():
            message_id = self._get_next_message_id()
            message = CDPMessage(method, params, message_id)

            # Create future for response
            future = asyncio.Future()
            self.pending_requests[message_id] = future

            try:
                # Send message
                await self.websocket.send(message.to_json())
                logger.debug(f"Sent CDP command: {method} (id: {message_id})")

                # Wait for response
                response_data = await asyncio.wait_for(future, timeout=timeout)
                response = CDPResponse(response_data)

                if response.is_error:
                    raise Exception(f"CDP command failed: {response.error_message}")

                return response

            finally:
                # Clean up pending request
                self.pending_requests.pop(message_id, None)

        return await self.resilience_service.retry_handler.execute_with_retry(_send_command)

    async def send_event(self, method: str, params: Optional[Dict[str, Any]] = None):
        """Send event (no response expected)"""
        if not self.is_connected:
            raise Exception("CDP connection is not established")

        message = CDPMessage(method, params)
        await self.websocket.send(message.to_json())
        logger.debug(f"Sent CDP event: {method}")

    def add_event_handler(self, method: str, handler: Callable):
        """Add event handler for specific CDP event"""
        if method not in self.event_handlers:
            self.event_handlers[method] = []
        self.event_handlers[method].append(handler)

    def remove_event_handler(self, method: str, handler: Callable):
        """Remove event handler"""
        if method in self.event_handlers:
            self.event_handlers[method].remove(handler)
            if not self.event_handlers[method]:
                del self.event_handlers[method]

    async def _message_loop(self):
        """Main message loop for handling CDP messages"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to decode CDP message: {str(e)}")
                except Exception as e:
                    logger.error(f"Error handling CDP message: {str(e)}")

        except ConnectionClosed:
            logger.warning(f"CDP connection {self.connection_id} closed by remote")
        except Exception as e:
            logger.error(f"Error in CDP message loop: {str(e)}")
        finally:
            self.is_connected = False

    async def _handle_message(self, data: Dict[str, Any]):
        """Handle incoming CDP message"""
        # Check if this is a response to a pending request
        if "id" in data and data["id"] in self.pending_requests:
            future = self.pending_requests.pop(data["id"])
            if not future.done():
                future.set_result(data)

        # Check if this is an event
        elif "method" in data:
            response = CDPResponse(data)
            await self._handle_event(response)

    async def _handle_event(self, response: CDPResponse):
        """Handle CDP event"""
        method = response.method
        if method in self.event_handlers:
            handlers = self.event_handlers[method][:]
            for handler in handlers:
                try:
                    await handler(response.params)
                except Exception as e:
                    logger.error(f"Error in CDP event handler for {method}: {str(e)}")

    def _get_next_message_id(self) -> int:
        """Get next message ID"""
        self.message_id += 1
        return self.message_id


class CDPService:
    """Main Chrome DevTools Protocol service with network resilience"""

    def __init__(self, config: Optional[NetworkResilienceConfig] = None):
        self.config = config or NetworkResilienceConfig()
        self.resilience_service = get_network_resilience_service()
        self._connections: Dict[str, CDPConnection] = {}
        self._lock = asyncio.Lock()
        self._monitoring_tasks: Dict[str, asyncio.Task] = {}

    async def connect_to_browser(self, debugger_url: str, connection_id: str) -> Optional[CDPConnection]:
        """Connect to browser via Chrome DevTools Protocol"""
        try:
            # Get WebSocket debugger URL
            websocket_url = await self._get_websocket_url(debugger_url)
            if not websocket_url:
                return None

            # Create connection
            connection = CDPConnection(websocket_url, self.resilience_service, connection_id)

            # Connect with resilience
            if await connection.connect():
                async with self._lock:
                    self._connections[connection_id] = connection

                logger.info(f"Connected to browser via CDP: {connection_id}")
                return connection
            else:
                return None

        except Exception as e:
            logger.error(f"Failed to connect to browser via CDP: {str(e)}")
            return None

    async def disconnect_from_browser(self, connection_id: str) -> bool:
        """Disconnect from browser"""
        async with self._lock:
            connection = self._connections.get(connection_id)
            if connection:
                await connection.disconnect()
                del self._connections[connection_id]

                # Stop monitoring if active
                if connection_id in self._monitoring_tasks:
                    self._monitoring_tasks[connection_id].cancel()
                    del self._monitoring_tasks[connection_id]

                logger.info(f"Disconnected from browser via CDP: {connection_id}")
                return True
            return False

    async def enable_domain(self, connection_id: str, domain: str) -> bool:
        """Enable CDP domain for monitoring"""
        connection = self._connections.get(connection_id)
        if not connection:
            return False

        try:
            response = await connection.send_command(f"{domain}.enable")
            logger.info(f"Enabled CDP domain {domain} for connection {connection_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to enable CDP domain {domain}: {str(e)}")
            return False

    async def disable_domain(self, connection_id: str, domain: str) -> bool:
        """Disable CDP domain"""
        connection = self._connections.get(connection_id)
        if not connection:
            return False

        try:
            response = await connection.send_command(f"{domain}.disable")
            logger.info(f"Disabled CDP domain {domain} for connection {connection_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to disable CDP domain {domain}: {str(e)}")
            return False

    async def get_page_info(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Get page information via CDP"""
        connection = self._connections.get(connection_id)
        if not connection:
            return None

        try:
            response = await connection.send_command("Runtime.enable")
            response = await connection.send_command("Page.enable")

            # Get document
            response = await connection.send_command("DOM.getDocument")
            root_node_id = response.result["root"]["nodeId"]

            # Get page info
            response = await connection.send_command("Runtime.evaluate", {
                "expression": "document.title"
            })
            title = response.result["result"].get("value", "")

            response = await connection.send_command("Runtime.evaluate", {
                "expression": "window.location.href"
            })
            url = response.result["result"].get("value", "")

            return {
                "title": title,
                "url": url,
                "root_node_id": root_node_id
            }

        except Exception as e:
            logger.error(f"Failed to get page info via CDP: {str(e)}")
            return None

    async def monitor_network_activity(self, connection_id: str, callback: Callable):
        """Monitor network activity via CDP"""
        connection = self._connections.get(connection_id)
        if not connection:
            return False

        try:
            # Enable network domain
            await self.enable_domain(connection_id, "Network")

            # Add event handlers
            connection.add_event_handler("Network.requestWillBeSent", callback)
            connection.add_event_handler("Network.responseReceived", callback)
            connection.add_event_handler("Network.loadingFailed", callback)

            logger.info(f"Started network monitoring for connection {connection_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to start network monitoring: {str(e)}")
            return False

    async def monitor_dom_changes(self, connection_id: str, callback: Callable):
        """Monitor DOM changes via CDP"""
        connection = self._connections.get(connection_id)
        if not connection:
            return False

        try:
            # Enable DOM domain
            await self.enable_domain(connection_id, "DOM")

            # Add event handlers
            connection.add_event_handler("DOM.documentUpdated", callback)
            connection.add_event_handler("DOM.setChildNodes", callback)
            connection.add_event_handler("DOM.childNodeCountUpdated", callback)

            logger.info(f"Started DOM monitoring for connection {connection_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to start DOM monitoring: {str(e)}")
            return False

    async def monitor_console_messages(self, connection_id: str, callback: Callable):
        """Monitor console messages via CDP"""
        connection = self._connections.get(connection_id)
        if not connection:
            return False

        try:
            # Enable console domain
            await self.enable_domain(connection_id, "Runtime")

            # Add event handlers
            connection.add_event_handler("Runtime.consoleAPICalled", callback)
            connection.add_event_handler("Runtime.exceptionThrown", callback)

            logger.info(f"Started console monitoring for connection {connection_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to start console monitoring: {str(e)}")
            return False

    async def start_periodic_monitoring(self, connection_id: str, interval: float = 30.0):
        """Start periodic monitoring of connection health"""
        async def _monitor_connection():
            while True:
                try:
                    connection = self._connections.get(connection_id)
                    if not connection or not connection.is_connected:
                        logger.warning(f"CDP connection {connection_id} lost, attempting to reconnect...")
                        # Attempt to reconnect
                        # This would need the original debugger URL
                        break

                    # Send a simple command to check connection health
                    await connection.send_command("Runtime.enable", timeout=10.0)
                    logger.debug(f"CDP connection {connection_id} health check passed")

                except Exception as e:
                    logger.error(f"CDP connection {connection_id} health check failed: {str(e)}")

                await asyncio.sleep(interval)

        # Stop existing monitoring if any
        self.stop_periodic_monitoring(connection_id)

        # Start new monitoring task
        task = asyncio.create_task(_monitor_connection())
        self._monitoring_tasks[connection_id] = task
        logger.info(f"Started periodic monitoring for CDP connection {connection_id}")

    def stop_periodic_monitoring(self, connection_id: str):
        """Stop periodic monitoring"""
        if connection_id in self._monitoring_tasks:
            self._monitoring_tasks[connection_id].cancel()
            del self._monitoring_tasks[connection_id]
            logger.info(f"Stopped periodic monitoring for CDP connection {connection_id}")

    async def _get_websocket_url(self, debugger_url: str) -> Optional[str]:
        """Get WebSocket debugger URL from browser"""
        try:
            # Try to get the JSON list of available targets
            json_url = f"{debugger_url}/json"
            if not json_url.startswith("http"):
                json_url = f"http://{json_url}"

            session = await self.resilience_service.connection_pool.get_session()
            async with session.get(json_url) as response:
                if response.status == 200:
                    targets = await response.json()
                    if targets and len(targets) > 0:
                        # Use the first available target
                        target = targets[0]
                        websocket_url = target.get("webSocketDebuggerUrl")
                        if websocket_url:
                            return websocket_url

            # Fallback: construct WebSocket URL manually
            if debugger_url.startswith("http"):
                ws_url = debugger_url.replace("http", "ws", 1)
            else:
                ws_url = f"ws://{debugger_url}"

            return f"{ws_url}/devtools/browser"

        except Exception as e:
            logger.error(f"Failed to get WebSocket URL: {str(e)}")
            return None

    async def get_connection_info(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Get connection information"""
        connection = self._connections.get(connection_id)
        if not connection:
            return None

        return {
            "connection_id": connection_id,
            "is_connected": connection.is_connected,
            "websocket_url": connection.websocket_url,
            "message_id": connection.message_id,
            "pending_requests": len(connection.pending_requests),
            "event_handlers": len(connection.event_handlers)
        }

    async def cleanup(self):
        """Cleanup all connections"""
        # Stop all monitoring tasks
        for task in self._monitoring_tasks.values():
            task.cancel()

        # Wait for tasks to complete
        if self._monitoring_tasks:
            await asyncio.gather(*self._monitoring_tasks.values(), return_exceptions=True)

        # Disconnect all connections
        connections = list(self._connections.keys())
        for connection_id in connections:
            await self.disconnect_from_browser(connection_id)

        self._monitoring_tasks.clear()
        self._connections.clear()

        logger.info("CDP service cleanup completed")

    @property
    def active_connections(self) -> List[str]:
        """Get list of active connection IDs"""
        return list(self._connections.keys())

    @property
    def connections_count(self) -> int:
        """Get number of active connections"""
        return len(self._connections)


# Global service instance
_cdp_service: Optional[CDPService] = None


async def get_cdp_service() -> CDPService:
    """Get global CDP service instance"""
    global _cdp_service
    if _cdp_service is None:
        _cdp_service = CDPService()
    return _cdp_service


async def init_cdp_service(config: Optional[NetworkResilienceConfig] = None):
    """Initialize global CDP service"""
    global _cdp_service
    _cdp_service = CDPService(config)
    logger.info("CDP service initialized")


async def cleanup_cdp_service():
    """Cleanup global CDP service"""
    global _cdp_service
    if _cdp_service:
        await _cdp_service.cleanup()
        _cdp_service = None
        logger.info("CDP service cleaned up")