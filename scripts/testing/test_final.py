
import requests
import json

print("Testing authentication...")
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": "admin", "password": "admin"}
)

if response.status_code == 200:
    token = response.json()["access_token"]
    print(f"✅ Login successful! Token: {token[:30]}...")
    
    # Test projects
    headers = {"Authorization": f"Bearer {token}"}
    proj_resp = requests.get("http://localhost:8000/api/v1/projects", headers=headers)
    print(f"✅ Projects endpoint: {proj_resp.status_code}")
else:
    print(f"❌ Login failed: {response.status_code}")
    print(f"   {response.text}")
