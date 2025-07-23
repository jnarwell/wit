import requests
import jwt
import datetime
import json

# --- Configuration ---
API_BASE_URL = "http://localhost:8000"
# This is the default secret key from dev_server.py
SECRET_KEY = "your-secret-key-here-change-in-production" 
ALGORITHM = "HS256"
# Use a placeholder project ID. This may need to be changed to a real ID from the database.
TEST_PROJECT_ID = "PROJ-20240723120000" 
# --- End Configuration ---

def create_test_token():
    """Creates a valid JWT for the test."""
    payload = {
        "sub": "admin",
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def trace_get_project():
    """Traces a GET request for a single project."""
    project_url = f"{API_BASE_URL}/api/v1/projects/{TEST_PROJECT_ID}"
    token = create_test_token()
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    print("--- Initiating GET Request Trace ---")
    print(f"1. Target URL: {project_url}")
    print(f"2. HTTP Method: GET")
    print(f"3. Headers: {headers}")

    try:
        print("\n4. Sending request...")
        response = requests.get(project_url, headers=headers, timeout=10)
        print("...Request sent.")

        print(f"\n5. Response Received")
        print(f"   - Status Code: {response.status_code}")
        print(f"   - Reason: {response.reason}")
        
        print("\n6. Response Headers:")
        for key, value in response.headers.items():
            print(f"   - {key}: {value}")

        print("\n7. Response Body:")
        try:
            response_json = response.json()
            print(json.dumps(response_json, indent=2))
        except json.JSONDecodeError:
            print("   - (Could not decode JSON body)")
            print(f"   - Raw Text: {response.text}")

    except requests.exceptions.ConnectionError as e:
        print("\n--- TRACE FAILED ---")
        print(f"Connection Error: {e}")
        print("\nIs the server running correctly? The test could not connect.")
    except Exception as e:
        print(f"\n--- TRACE FAILED ---")
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    trace_get_project()
