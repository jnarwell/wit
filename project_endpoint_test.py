import requests
import jwt
import datetime

# --- Configuration ---
API_BASE_URL = "http://localhost:8000"
# This is the default secret key from dev_server.py
SECRET_KEY = "your-secret-key-here-change-in-production" 
ALGORITHM = "HS256"
# --- End Configuration ---

def create_test_token():
    """Creates a valid JWT for the test."""
    payload = {
        "sub": "admin",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def run_test():
    """Runs the test against the projects endpoint."""
    projects_url = f"{API_BASE_URL}/api/v1/projects"
    token = create_test_token()
    
    headers = {
        "Authorization": f"Bearer {token}"
    }

    print(f"--- Testing Projects Endpoint ---")
    print(f"URL: {projects_url}")
    print(f"Method: GET")
    print(f"Headers: {{'Authorization': 'Bearer <token>'}}")

    try:
        response = requests.get(projects_url, headers=headers, timeout=10)
        
        print(f"\n--- Response ---")
        print(f"Status Code: {response.status_code}")
        
        try:
            # Try to parse and print JSON response
            response_json = response.json()
            print("Response Body (JSON):")
            import json
            print(json.dumps(response_json, indent=2))
        except requests.exceptions.JSONDecodeError:
            # If it's not JSON, print the raw text
            print("Response Body (Raw Text):")
            print(response.text)

    except requests.exceptions.ConnectionError as e:
        print("\n--- Error ---")
        print(f"Connection Error: {e}")
        print("\nIs the server running? Please ensure the dev server is running before executing this test.")
    except Exception as e:
        print(f"\n--- An unexpected error occurred ---")
        print(e)

if __name__ == "__main__":
    run_test()
