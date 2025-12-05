#!/usr/bin/env python3
"""
Test script for authentication service
"""

import asyncio
import httpx
import json
from datetime import datetime


async def test_authentication():
    """Test authentication endpoints"""
    base_url = "http://localhost:8000/api/v1/auth"

    async with httpx.AsyncClient() as client:
        try:
            print("🧪 Testing UITrace Authentication Service")
            print("=" * 50)

            # Test server health
            print("\n1. Testing server health...")
            health_response = await client.get("http://localhost:8000/health")
            if health_response.status_code == 200:
                print("✅ Server is healthy")
            else:
                print(f"❌ Server health check failed: {health_response.status_code}")
                return

            # Test registration
            print("\n2. Testing user registration...")
            register_data = {
                "username": "testuser",
                "email": "test@uitrace.com",
                "password": "testpassword123",
                "full_name": "Test User"
            }

            register_response = await client.post(f"{base_url}/register", json=register_data)
            if register_response.status_code == 200:
                print("✅ User registration successful")
                print(f"   Response: {register_response.json()}")
            elif register_response.status_code == 400:
                print("⚠️  User might already exist (expected for subsequent runs)")
                print(f"   Response: {register_response.json()}")
            else:
                print(f"❌ Registration failed: {register_response.status_code}")
                print(f"   Response: {register_response.text}")

            # Test login
            print("\n3. Testing user login...")
            login_data = {
                "username": "testuser",
                "password": "testpassword123"
            }

            login_response = await client.post(f"{base_url}/login", json=login_data)
            if login_response.status_code == 200:
                print("✅ User login successful")
                login_result = login_response.json()
                access_token = login_result["access_token"]
                print(f"   Access Token: {access_token[:50]}...")
                print(f"   Token Type: {login_result['token_type']}")
                print(f"   Expires In: {login_result['expires_in']} seconds")
            else:
                print(f"❌ Login failed: {login_response.status_code}")
                print(f"   Response: {login_response.text}")
                return

            # Test get current user info
            print("\n4. Testing get current user info...")
            headers = {"Authorization": f"Bearer {access_token}"}
            me_response = await client.get(f"{base_url}/me", headers=headers)
            if me_response.status_code == 200:
                print("✅ Get user info successful")
                user_info = me_response.json()
                print(f"   Username: {user_info['username']}")
                print(f"   Email: {user_info['email']}")
                print(f"   Role: {user_info['role']}")
            else:
                print(f"❌ Get user info failed: {me_response.status_code}")
                print(f"   Response: {me_response.text}")

            # Test token verification
            print("\n5. Testing token verification...")
            verify_response = await client.get(f"{base_url}/verify?token={access_token}")
            if verify_response.status_code == 200:
                print("✅ Token verification successful")
                verify_result = verify_response.json()
                print(f"   Valid: {verify_result['valid']}")
                print(f"   Username: {verify_result['username']}")
            else:
                print(f"❌ Token verification failed: {verify_response.status_code}")
                print(f"   Response: {verify_response.text}")

            # Test logout
            print("\n6. Testing logout...")
            logout_response = await client.post(f"{base_url}/logout", headers=headers)
            if logout_response.status_code == 200:
                print("✅ Logout successful")
                print(f"   Response: {logout_response.json()}")
            else:
                print(f"❌ Logout failed: {logout_response.status_code}")
                print(f"   Response: {logout_response.text}")

            print("\n" + "=" * 50)
            print("🎉 Authentication service tests completed!")

        except httpx.ConnectError:
            print("❌ Cannot connect to server. Make sure the server is running on port 8000.")
        except Exception as e:
            print(f"❌ Test failed with error: {e}")


if __name__ == "__main__":
    asyncio.run(test_authentication())