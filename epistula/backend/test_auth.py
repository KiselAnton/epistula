"""Test authentication endpoints from WSL.

This script tests:
1. Root user creation
2. Login with root credentials
3. Token validation via /me endpoint
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API base URL
BASE_URL = "http://localhost:8002"

# Root user credentials from environment
ROOT_EMAIL = os.getenv("ROOT_EMAIL", "root@localhost.localdomain")
ROOT_PASSWORD = os.getenv("ROOT_PASSWORD", "changeme123")


def test_login():
    """Test login endpoint"""
    print("=" * 70)
    print("Testing Authentication System")
    print("=" * 70)
    
    # Test 1: Login with root credentials
    print("\n1. Testing login with root credentials...")
    login_url = f"{BASE_URL}/api/v1/auth/login"
    
    login_data = {
        "email": ROOT_EMAIL,
        "password": ROOT_PASSWORD
    }
    
    print(f"   POST {login_url}")
    print(f"   Email: {ROOT_EMAIL}")
    print(f"   Password: {'*' * len(ROOT_PASSWORD)}")
    
    try:
        response = requests.post(login_url, json=login_data)
        
        if response.status_code == 200:
            print("   ✓ Login successful!")
            data = response.json()
            token = data.get("access_token")
            user = data.get("user")
            
            print(f"   Token: {token[:20]}...{token[-10:]}")
            print(f"   User ID: {user.get('id')}")
            print(f"   User Email: {user.get('email')}")
            print(f"   User Name: {user.get('name')}")
            print(f"   User Role: {user.get('role')}")
            
            return token
        else:
            print(f"   ✗ Login failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    
    except Exception as e:
        print(f"   ✗ Error: {str(e)}")
        return None


def test_get_me(token):
    """Test /me endpoint with token"""
    print("\n2. Testing /me endpoint with token...")
    me_url = f"{BASE_URL}/api/v1/auth/me"
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print(f"   GET {me_url}")
    print(f"   Authorization: Bearer {token[:20]}...{token[-10:]}")
    
    try:
        response = requests.get(me_url, headers=headers)
        
        if response.status_code == 200:
            print("   ✓ /me endpoint successful!")
            user = response.json()
            
            print(f"   User ID: {user.get('id')}")
            print(f"   User Email: {user.get('email')}")
            print(f"   User Name: {user.get('name')}")
            print(f"   User Role: {user.get('role')}")
            print(f"   Is Active: {user.get('is_active')}")
            
            return True
        else:
            print(f"   ✗ /me failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    
    except Exception as e:
        print(f"   ✗ Error: {str(e)}")
        return False


def test_logout(token):
    """Test logout endpoint"""
    print("\n3. Testing logout endpoint...")
    logout_url = f"{BASE_URL}/api/v1/auth/logout"
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print(f"   POST {logout_url}")
    
    try:
        response = requests.post(logout_url, headers=headers)
        
        if response.status_code == 200:
            print("   ✓ Logout successful!")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"   ✗ Logout failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    
    except Exception as e:
        print(f"   ✗ Error: {str(e)}")
        return False


def main():
    """Run all authentication tests"""
    # Test login
    token = test_login()
    
    if not token:
        print("\n✗ Authentication tests failed - could not login")
        return
    
    # Test /me endpoint
    test_get_me(token)
    
    # Test logout
    test_logout(token)
    
    print("\n" + "=" * 70)
    print("Authentication tests completed!")
    print("=" * 70)


if __name__ == "__main__":
    main()
