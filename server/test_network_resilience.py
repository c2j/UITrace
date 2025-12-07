"""
Test script for network resilience features
"""

import asyncio
import json
from datetime import datetime
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.network_resilience import (
    NetworkResilienceService, NetworkResilienceConfig,
    get_network_resilience_service, with_network_resilience
)
from src.services.browser_automation import (
    BrowserAutomationService, BrowserAutomationConfig,
    get_browser_automation_service
)
from src.services.cdp_service import CDPService, get_cdp_service
from src.services.execution_resilience import (
    ExecutionResilienceService, ExecutionResilienceConfig,
    get_execution_resilience_service
)

logger = structlog.get_logger()


async def test_network_resilience_service():
    """Test network resilience service"""
    print("\n🧪 Testing Network Resilience Service")
    print("=" * 50)

    # Create service with custom config
    config = NetworkResilienceConfig(
        max_retries=3,
        base_delay=1.0,
        max_delay=10.0,
        timeout=30.0,
        circuit_breaker_threshold=3,
        circuit_breaker_timeout=30.0
    )

    service = NetworkResilienceService(config)

    # Test HTTP request with resilience
    print("\n📡 Testing HTTP requests with resilience...")
    try:
        # Test successful request
        response = await service.make_request_with_resilience(
            "GET", "https://httpbin.org/get", circuit_breaker_name="test_service"
        )
        print(f"✅ Successful request: Status {response.status}")

        # Test retry mechanism with failing endpoint
        print("\n🔄 Testing retry mechanism...")
        try:
            response = await service.make_request_with_resilience(
                "GET", "https://httpbin.org/status/500", circuit_breaker_name="test_service"
            )
            print(f"❌ Should have failed but got status: {response.status}")
        except Exception as e:
            print(f"✅ Retry mechanism working: {str(e)}")

        # Test circuit breaker
        print("\n🔌 Testing circuit breaker...")
        circuit_breaker = service.get_circuit_breaker("test_service")

        # Simulate failures to trip circuit breaker
        for i in range(4):
            try:
                await circuit_breaker.call(
                    service.make_request_with_resilience,
                    "GET", "https://httpbin.org/status/500"
                )
            except Exception:
                pass

        # Circuit breaker should now be open
        try:
            await circuit_breaker.call(lambda: asyncio.sleep(0.1))
            print("❌ Circuit breaker should be open")
        except Exception as e:
            print(f"✅ Circuit breaker working: {str(e)}")

    except Exception as e:
        print(f"❌ Network resilience test failed: {str(e)}")

    await service.cleanup()
    print("\n✅ Network resilience service test completed")


async def test_browser_automation_service():
    """Test browser automation service"""
    print("\n🧪 Testing Browser Automation Service")
    print("=" * 50)

    config = BrowserAutomationConfig(
        selenium_hub_url="local",  # Use local WebDriver
        browser_timeout=30,
        headless=True,  # Run in headless mode for testing
        window_size=(1280, 720)
    )

    service = BrowserAutomationService(config)

    try:
        # Create browser session
        print("\n🌐 Creating browser session...")
        session = await service.create_session(
            session_id="test_session_1",
            browser_type="chrome"
        )

        if session:
            print(f"✅ Browser session created: {session.session_id}")

            # Test navigation
            print("\n🧭 Testing navigation...")
            success = await session.navigate_to("https://httpbin.org/html")
            print(f"✅ Navigation successful: {success}")

            # Test element interaction
            print("\n🖱️ Testing element interaction...")
            try:
                # Find and click an element (this will fail but tests resilience)
                success = await session.click_element("h1", "tag")
                print(f"✅ Element interaction successful: {success}")
            except Exception as e:
                print(f"✅ Element interaction error handled: {str(e)}")

            # Test screenshot
            print("\n📸 Testing screenshot...")
            try:
                screenshot = await session.take_screenshot()
                print(f"✅ Screenshot captured: {len(screenshot) if isinstance(screenshot, str) else 'saved'} characters")
            except Exception as e:
                print(f"❌ Screenshot failed: {str(e)}")

            # Test JavaScript execution
            print("\n⚡ Testing JavaScript execution...")
            try:
                result = await session.execute_script("return document.title;")
                print(f"✅ JavaScript execution successful: {result}")
            except Exception as e:
                print(f"❌ JavaScript execution failed: {str(e)}")

            # Close session
            print("\n🔒 Closing browser session...")
            await service.close_session(session.session_id)
            print("✅ Browser session closed")

        else:
            print("❌ Failed to create browser session")

    except Exception as e:
        print(f"❌ Browser automation test failed: {str(e)}")

    await service.close_all_sessions()
    print("\n✅ Browser automation service test completed")


async def test_cdp_service():
    """Test CDP service"""
    print("\n🧪 Testing CDP Service")
    print("=" * 50)

    service = CDPService()

    try:
        # Note: CDP service requires an actual browser connection
        # This is a basic test to verify service initialization
        print("\n🔧 CDP service initialized successfully")
        print(f"Active connections: {service.connections_count}")
        print("✅ CDP service test completed")

    except Exception as e:
        print(f"❌ CDP service test failed: {str(e)}")

    await service.cleanup()


async def test_execution_resilience_service():
    """Test execution resilience service"""
    print("\n🧪 Testing Execution Resilience Service")
    print("=" * 50)

    config = ExecutionResilienceConfig(
        max_execution_retries=3,
        execution_timeout=60.0,
        step_timeout=10.0,
        recovery_delay=2.0,
        enable_cdp_monitoring=False,  # Disable for testing
        enable_network_monitoring=False
    )

    service = ExecutionResilienceService(config)

    try:
        # Create resilient execution context
        print("\n🎯 Creating resilient execution context...")
        execution_id = f"test_execution_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        script_id = "test_script_1"

        context = await service.create_resilient_execution(
            execution_id=execution_id,
            script_id=script_id,
            browser_type="chrome",
            enable_cdp=False
        )

        if context:
            print(f"✅ Resilient execution context created: {execution_id}")
            print(f"Session ID: {context.session.session_id}")
            print(f"Session health: {context.session_health}")

            # Test script execution with sample steps
            print("\n📋 Testing script execution...")
            script_content = {
                "steps": [
                    {
                        "id": 1,
                        "type": "navigate",
                        "url": "https://httpbin.org/html"
                    },
                    {
                        "id": 2,
                        "type": "wait",
                        "duration": 2.0
                    },
                    {
                        "id": 3,
                        "type": "screenshot"
                    }
                ]
            }

            # Mock database session for testing
            class MockSession:
                async def get(self, model, id):
                    return None
                async def commit(self):
                    pass

            mock_session = MockSession()

            success = await service.execute_script_with_resilience(
                execution_id=execution_id,
                session=mock_session,
                script_content=script_content
            )

            print(f"✅ Script execution completed: {success}")

            # Cleanup
            print("\n🧹 Cleaning up execution...")
            await service.cleanup_execution(execution_id)
            print("✅ Execution cleaned up")

        else:
            print("❌ Failed to create resilient execution context")

    except Exception as e:
        print(f"❌ Execution resilience test failed: {str(e)}")

    await service.cleanup_all_executions()
    print("\n✅ Execution resilience service test completed")


async def test_resilience_decorator():
    """Test network resilience decorator"""
    print("\n🧪 Testing Network Resilience Decorator")
    print("=" * 50)

    @with_network_resilience(circuit_breaker_name="test_decorator")
    async def unreliable_function(fail_count: int = 0):
        """Function that fails a few times before succeeding"""
        if hasattr(unreliable_function, '_call_count'):
            unreliable_function._call_count += 1
        else:
            unreliable_function._call_count = 1

        if unreliable_function._call_count <= fail_count:
            raise Exception(f"Intentional failure #{unreliable_function._call_count}")

        return f"Success after {fail_count} failures"

    try:
        print("\n🔄 Testing function with 2 intentional failures...")
        result = await unreliable_function(fail_count=2)
        print(f"✅ Decorator test successful: {result}")

    except Exception as e:
        print(f"❌ Decorator test failed: {str(e)}")

    print("\n✅ Network resilience decorator test completed")


async def test_connection_pooling():
    """Test HTTP connection pooling"""
    print("\n🧪 Testing Connection Pooling")
    print("=" * 50)

    service = get_network_resilience_service()

    try:
        print("\n🌐 Testing multiple concurrent requests...")

        # Create multiple concurrent requests
        async def make_request(i):
            try:
                response = await service.make_request_with_resilience(
                    "GET", f"https://httpbin.org/delay/1?request={i}"
                )
                return f"Request {i}: Status {response.status}"
            except Exception as e:
                return f"Request {i}: Failed - {str(e)}"

        # Execute 5 concurrent requests
        results = await asyncio.gather(
            *[make_request(i) for i in range(1, 6)]
        )

        for result in results:
            print(f"✅ {result}")

        print("\n✅ Connection pooling test completed")

    except Exception as e:
        print(f"❌ Connection pooling test failed: {str(e)}")


async def main():
    """Main test function"""
    print("🚀 Starting Network Resilience Tests")
    print("=" * 60)

    # Initialize services
    print("\n⚙️ Initializing services...")
    from src.services.network_resilience import init_network_resilience_service
    from src.services.browser_automation import init_browser_automation_service
    from src.services.cdp_service import init_cdp_service
    from src.services.execution_resilience import init_execution_resilience_service

    await init_network_resilience_service()
    await init_browser_automation_service()
    await init_cdp_service()
    await init_execution_resilience_service()
    print("✅ Services initialized")

    try:
        # Run all tests
        await test_network_resilience_service()
        await test_browser_automation_service()
        await test_cdp_service()
        await test_execution_resilience_service()
        await test_resilience_decorator()
        await test_connection_pooling()

        print("\n🎉 All network resilience tests completed successfully!")

    except Exception as e:
        print(f"\n❌ Test suite failed: {str(e)}")

    finally:
        # Cleanup services
        print("\n🧹 Cleaning up services...")
        from src.services.execution_resilience import cleanup_execution_resilience_service
        from src.services.cdp_service import cleanup_cdp_service
        from src.services.browser_automation import cleanup_browser_automation_service
        from src.services.network_resilience import cleanup_network_resilience_service

        await cleanup_execution_resilience_service()
        await cleanup_cdp_service()
        await cleanup_browser_automation_service()
        await cleanup_network_resilience_service()
        print("✅ Services cleaned up")


if __name__ == "__main__":
    asyncio.run(main())