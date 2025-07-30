#!/usr/bin/env python3
"""Test admin panel user creation and deletion"""
import requests
import json

BASE_URL = "http://localhost:8000"

# Step 1: Login as admin
print("1. Logging in as admin...")
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/token",
    data={"username": "admin", "password": "admin"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if login_response.status_code == 200:
    print("✅ Admin login successful!")
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Get initial user list
    print("\n2. Getting initial user list...")
    users_response = requests.get(f"{BASE_URL}/api/v1/admin/users", headers=headers)
    if users_response.status_code == 200:
        initial_users = users_response.json()
        print(f"✅ Initial user count: {initial_users['total']}")
        for user in initial_users['users']:
            print(f"   - {user['username']} ({user['email']}) - Admin: {user['is_admin']}")
    
    # Step 3: Create a new user via admin panel
    print("\n3. Creating new user 'testuser123'...")
    new_user = {
        "username": "testuser123",
        "email": "testuser123@example.com",
        "password": "test123",
        "is_admin": False
    }
    create_response = requests.post(
        f"{BASE_URL}/api/v1/admin/users",
        json=new_user,
        headers=headers
    )
    
    if create_response.status_code == 200:
        print("✅ User created successfully!")
        created_user = create_response.json()
        user_id = created_user['id']
        
        # Step 4: Verify user can login
        print("\n4. Testing login with new user...")
        test_login = requests.post(
            f"{BASE_URL}/api/v1/auth/token",
            data={"username": "testuser123", "password": "test123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if test_login.status_code == 200:
            print("✅ New user can login successfully!")
        else:
            print(f"❌ Login failed: {test_login.status_code}")
        
        # Step 5: Get updated user list
        print("\n5. Getting updated user list...")
        users_response = requests.get(f"{BASE_URL}/api/v1/admin/users", headers=headers)
        if users_response.status_code == 200:
            updated_users = users_response.json()
            print(f"✅ Updated user count: {updated_users['total']}")
            
        # Step 6: Delete the test user
        print(f"\n6. Deleting test user (ID: {user_id})...")
        delete_response = requests.delete(
            f"{BASE_URL}/api/v1/admin/users/{user_id}",
            headers=headers
        )
        
        if delete_response.status_code == 200:
            print("✅ User deleted successfully!")
            
            # Step 7: Verify user can't login anymore
            print("\n7. Verifying deleted user can't login...")
            test_login = requests.post(
                f"{BASE_URL}/api/v1/auth/token",
                data={"username": "testuser123", "password": "test123"},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if test_login.status_code != 200:
                print("✅ Deleted user cannot login (as expected)")
            else:
                print("❌ Deleted user can still login!")
                
        else:
            print(f"❌ Delete failed: {delete_response.status_code}")
            print(f"   Response: {delete_response.text}")
            
    else:
        print(f"❌ Create failed: {create_response.status_code}")
        print(f"   Response: {create_response.text}")

    # Step 8: Get admin stats
    print("\n8. Getting admin stats...")
    stats_response = requests.get(f"{BASE_URL}/api/v1/admin/stats", headers=headers)
    if stats_response.status_code == 200:
        stats = stats_response.json()
        print("✅ Admin stats:")
        print(f"   - Total users: {stats['total_users']}")
        print(f"   - Active users: {stats['active_users']}")
        print(f"   - Admin users: {stats['admin_users']}")
        
else:
    print(f"❌ Admin login failed: {login_response.status_code}")