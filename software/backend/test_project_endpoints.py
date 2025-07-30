#!/usr/bin/env python3
"""Test project endpoints"""
import requests
import json

BASE_URL = "http://localhost:8000"

# Step 1: Login
print("1. Logging in as admin...")
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/token",
    data={"username": "admin", "password": "admin"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if login_response.status_code == 200:
    print("✅ Login successful!")
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: List projects
    print("\n2. Listing projects...")
    list_response = requests.get(f"{BASE_URL}/api/v1/projects/", headers=headers)
    print(f"Status: {list_response.status_code}")
    if list_response.status_code == 200:
        projects = list_response.json()
        print(f"Found {len(projects)} projects")
        for p in projects:
            print(f"  - {p.get('project_id', p['id'])}: {p['name']}")
    
    # Step 3: Create a test project
    print("\n3. Creating test project...")
    project_data = {
        "name": "Test Project API",
        "description": "Testing project endpoints",
        "type": "software",
        "status": "in_progress"
    }
    create_response = requests.post(
        f"{BASE_URL}/api/v1/projects/",
        json=project_data,
        headers=headers
    )
    print(f"Status: {create_response.status_code}")
    if create_response.status_code == 200:
        created_project = create_response.json()
        project_id = created_project.get("project_id", created_project["id"])
        print(f"✅ Created project: {project_id}")
        
        # Step 4: Get the project by ID
        print(f"\n4. Getting project {project_id}...")
        get_response = requests.get(f"{BASE_URL}/api/v1/projects/{project_id}", headers=headers)
        print(f"Status: {get_response.status_code}")
        if get_response.status_code == 200:
            print("✅ Successfully retrieved project")
        else:
            print(f"❌ Error: {get_response.text}")
        
        # Step 5: Update the project
        print(f"\n5. Updating project {project_id}...")
        update_data = {
            "name": "Updated Test Project",
            "status": "completed"
        }
        update_response = requests.put(
            f"{BASE_URL}/api/v1/projects/{project_id}",
            json=update_data,
            headers=headers
        )
        print(f"Status: {update_response.status_code}")
        if update_response.status_code == 200:
            print("✅ Successfully updated project")
        else:
            print(f"❌ Error: {update_response.text}")
        
        # Step 6: Delete the project
        print(f"\n6. Deleting project {project_id}...")
        delete_response = requests.delete(
            f"{BASE_URL}/api/v1/projects/{project_id}",
            headers=headers
        )
        print(f"Status: {delete_response.status_code}")
        if delete_response.status_code == 200:
            print("✅ Successfully deleted project")
        else:
            print(f"❌ Error: {delete_response.text}")
        
        # Step 7: Verify deletion
        print(f"\n7. Verifying project {project_id} is deleted...")
        verify_response = requests.get(f"{BASE_URL}/api/v1/projects/{project_id}", headers=headers)
        if verify_response.status_code == 404:
            print("✅ Project not found (as expected)")
        else:
            print(f"❌ Unexpected status: {verify_response.status_code}")
            
    else:
        print(f"❌ Create failed: {create_response.text}")
        
else:
    print(f"❌ Login failed: {login_response.status_code}")