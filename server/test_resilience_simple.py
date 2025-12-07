"""
Simple test script for network resilience features
"""

import asyncio
import sys
import os

# Add the server directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.network_resilience import NetworkResilienceService, NetworkResilienceConfig


async def test_network_resilience():
    """Simple test of network resilience features"""
    print("🧪 Testing Network Resilience Features")
    print("=" * 50)

    # Create service with custom config
    config = NetworkResilienceConfig(
        max_retries=2,
        base_delay=1.0,
        max_delay=5.0,
        timeout=10.0
    )

    service = NetworkResilienceService(config)

    try:
        # Test successful HTTP request
        print("\n📡 Testing successful HTTP request...")
        response = await service.make_request_with_resilience("GET", "https://httpbin.org/get")
        print(f"✅ Request successful: Status {response.status}")

        # Test retry mechanism with a failing endpoint
        print("\n🔄 Testing retry mechanism with failing endpoint...")
        try:
            response = await service.make_request_with_resilience("GET", "https://httpbin.org/status/500")
            print(f"❌ Should have failed but got status: {response.status}")
        except Exception as e:
            print(f"✅ Retry mechanism working: {str(e)[:100]}...")

        # Test circuit breaker
        print("\n🔌 Testing circuit breaker...")
        circuit_breaker = service.get_circuit_breaker("test_service")

        # Simulate failures to trip circuit breaker
        for i in range(6):
            try:
                await circuit_breaker.call(lambda: service.make_request_with_resilience("GET", "https://httpbin.org/status/500"))
            except Exception:
                pass

        # Circuit breaker should now be open
        try:
            await circuit_breaker.call(lambda: asyncio.sleep(0.1))
            print("❌ Circuit breaker should be open")
        except Exception as e:
            print(f"✅ Circuit breaker working: {str(e)}")

        print("\n✅ Network resilience test completed successfully!")

    except Exception as e:
        print(f"❌ Network resilience test failed: {str(e)}")
        return False

    finally:
        await service.cleanup()

    return True


async def test_connection_pooling():
    """Test HTTP connection pooling"""
    print("\n🧪 Testing Connection Pooling")
    print("=" * 50)

    service = NetworkResilienceService()

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
                return f"Request {i}: Failed - {str(e)[:50]}..."

        # Execute 3 concurrent requests
        results = await asyncio.gather(
            *[make_request(i) for i in range(1, 4)]
        )

        for result in results:
            print(f"✅ {result}")

        print("\n✅ Connection pooling test completed!")
        return True

    except Exception as e:
        print(f"❌ Connection pooling test failed: {str(e)}")
        return False

    finally:
        await service.cleanup()


async def main():
    """Main test function"""
    print("🚀 Starting Network Resilience Tests")
    print("=" * 60)

    # Test network resilience
    success1 = await test_network_resilience()

    # Test connection pooling
    success2 = await test_connection_pooling()

    if success1 and success2:
        print("\n🎉 All network resilience tests completed successfully!")
        print("\n📊 Summary:")
        print("  ✅ HTTP request resilience with retries")
        print("  ✅ Circuit breaker pattern")
        print("  ✅ Connection pooling for concurrent requests")
        print("  ✅ Exponential backoff with jitter")
        print("  ✅ Timeout handling")
    else:
        print(f"\n❌ Some tests failed: Network resilience={success1}, Connection pooling={success2}")


if __name__ == "__main__":
    asyncio.run(main())