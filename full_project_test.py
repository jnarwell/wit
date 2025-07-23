import requests
import jwt
import datetime
import json
import uuid

# --- Configuration ---
API_BASE_URL = "http://localhost:8000"
SECRET_KEY = "your-secret-key-here-change-in-production" 
ALGORITHM = "HS256"
# --- End Configuration ---

def create_test_token(user_id: str):
    """Creates a valid JWT for the test."""
    payload = {
        "sub": user_id,
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def get_admin_user_id():
    """Gets the admin user's ID from the server."""
    user_id_url = f"{API_BASE_URL}/api/v1/auth/user_id/admin"
    try:
        response = requests.get(user_id_url, timeout=10)
        response.raise_for_status()
        return response.json()["user_id"]
    except Exception as e:
        print(f"--- TEST FAILED: Could not get admin user ID ---")
        print(f"Error: {e}")
        if 'response' in locals():
            print(f"Response Body: {response.text}")
        return None

def run_full_test():
    """Runs a full create-then-fetch test against the projects endpoint."""
    
    # --- Step 1: Get the admin user's ID ---
    print("--- Step 1: Getting admin user ID ---")
    admin_user_id = get_admin_user_id()
    if not admin_user_id:
        return
    print(f"Admin user ID: {admin_user_id}")

    # --- Step 2: Create a new project ---
    print("\n--- Step 2: Creating Auth Token ---")
    token = create_test_token(admin_user_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    print("Token created successfully.")

    create_url = f"{API_BASE_URL}/api/v1/projects"
    project_name = f"Test Project {uuid.uuid4()}"
    new_project_data = {
        "name": project_name,
        "description": "A project created by an automated test.",
        "type": "software",
        "status": "planning",
        "extra_data": {
            "team": "Test Team",
            "priority": "high"
        }
    }
    
    print(f"\n--- Step 3: Creating a new project named '{project_name}' ---")
    print(f"URL: {create_url}")
    print(f"Data: {json.dumps(new_project_data, indent=2)}")

    created_project_id = None
    try:
        response = requests.post(create_url, headers=headers, json=new_project_data, timeout=10)
        response.raise_for_status()
        created_project = response.json()
        created_project_id = created_project.get("project_id")
        print("Project created successfully!")
        print(json.dumps(created_project, indent=2))
    except Exception as e:
        print(f"\n--- TEST FAILED: Could not create project ---")
        print(f"Error: {e}")
        if 'response' in locals():
            print(f"Response Body: {response.text}")
        return

    # --- Step 4: Fetch the newly created project ---
    if not created_project_id:
        print("\n--- TEST FAILED: No project_id returned from creation ---")
        return

    fetch_url = f"{API_BASE_URL}/api/v1/projects/{created_project_id}"
    print(f"\n--- Step 4: Fetching the project with ID '{created_project_id}' ---")
    print(f"URL: {fetch_url}")

    try:
        response = requests.get(fetch_url, headers=headers, timeout=10)
        response.raise_for_status()
        fetched_project = response.json()
        print("--- TEST SUCCEEDED: Project fetched successfully! ---")
        print(json.dumps(fetched_project, indent=2))
        
        assert fetched_project["name"] == project_name
        print("\nAssertion passed: Fetched project name matches created project name.")

    except Exception as e:
        print(f"\n--- TEST FAILED: Could not fetch project ---")
        print(f"Error: {e}")
        if 'response' in locals():
            print(f"Response Body: {response.text}")

if __name__ == "__main__":
    run_full_test()