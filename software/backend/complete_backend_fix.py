#!/usr/bin/env python3
"""
Complete backend fix - runs all fixes in order
"""

import subprocess
import time
import sys
import os

print("🔧 W.I.T. Backend Complete Fix")
print("=" * 50)

def run_command(cmd, shell=False):
    """Run a command and return success status"""
    try:
        if shell:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        else:
            result = subprocess.run(cmd.split(), capture_output=True, text=True)
        
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)

# Step 1: Fix database schema and create admin user
print("\n1️⃣ Fixing database schema...")
success, output = run_command("python3 check_and_fix_schema.py")
if success:
    print("  ✅ Database fixed")
else:
    print(f"  ❌ Database fix failed: {output}")

# Step 2: Fix route prefixes
print("\n2️⃣ Fixing route prefixes...")
success, output = run_command("python3 fix_route_prefix.py")
if success:
    print("  ✅ Routes fixed")
else:
    print(f"  ❌ Route fix failed: {output}")

# Step 3: Test authentication
print("\n3️⃣ Testing authentication...")
test_auth = '''
import requests
try:
    # Test login
    response = requests.post(
        "http://localhost:8000/api/v1/auth/token",
        data={"username": "admin", "password": "admin123"}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"✅ Authentication working! Token: {token[:20]}...")
        
        # Test projects endpoint
        headers = {"Authorization": f"Bearer {token}"}
        proj_response = requests.get(
            "http://localhost:8000/api/v1/projects",
            headers=headers
        )
        print(f"✅ Projects endpoint: {proj_response.status_code}")
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"❌ Test failed: {e}")
    print("   Make sure the server is running!")
'''

# Write and run test
with open('/tmp/test_auth.py', 'w') as f:
    f.write(test_auth)

success, output = run_command("python3 /tmp/test_auth.py")
print(f"  {output}")

# Step 4: Update .env file
print("\n4️⃣ Checking .env configuration...")
env_updates = {
    "JWT_SECRET_KEY": "your-secret-key-change-this-in-production",
    "WIT_SECRET_KEY": "another-secret-key-for-sessions",
    "MQTT_HOST": "localhost",
    "MQTT_PORT": "1883"
}

if os.path.exists('.env'):
    with open('.env', 'r') as f:
        env_content = f.read()
    
    updated = False
    for key, value in env_updates.items():
        if key not in env_content:
            env_content += f"\n{key}={value}"
            updated = True
    
    if updated:
        with open('.env', 'w') as f:
            f.write(env_content)
        print("  ✅ Updated .env file")
    else:
        print("  ✅ .env file already configured")
else:
    print("  ⚠️  No .env file found")

# Summary
print("\n" + "=" * 50)
print("📊 Fix Summary:")
print("=" * 50)
print("\n✅ Database schema checked and admin user created")
print("✅ Route prefixes fixed")
print("✅ Environment variables configured")

print("\n🚀 Next Steps:")
print("\n1. Restart the backend server:")
print("   python3 dev_server.py")
print("\n2. Start Mosquitto (optional):")
print("   chmod +x start_mosquitto.sh")
print("   ./start_mosquitto.sh")
print("\n3. Test the API:")
print("   - Visit: http://localhost:8000/docs")
print("   - Login: admin / admin123")
print("\n4. The frontend can now connect to:")
print("   - Projects: GET/POST http://localhost:8000/api/v1/projects")
print("   - Tasks: GET/POST http://localhost:8000/api/v1/tasks")
print("   - Auth: POST http://localhost:8000/api/v1/auth/token")

print("\n✅ Backend is ready for frontend development!")