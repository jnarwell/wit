#!/usr/bin/env python3
"""
WIT Platform Demo
Shows the complete functionality: Terminal -> Projects -> Files
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def get_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data={"username": "admin", "password": "admin"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    return response.json()["access_token"]

def main():
    print("🚀 WIT Platform Demo")
    print("=" * 50)
    
    # Get auth token
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Test Terminal Command
    print("\n1️⃣  Testing WIT Terminal...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={"command": "help", "history": []},
        headers=headers
    )
    print(f"Response: {response.json()['response']}")
    
    # 2. Create a Project via Terminal
    print("\n2️⃣  Creating project via terminal...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={"command": "create a new project called 'Robot Arm Controller'", "history": []},
        headers=headers
    )
    print(f"Response: {response.json()['response']}")
    
    # 3. List Projects
    print("\n3️⃣  Listing projects...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={"command": "show my projects", "history": []},
        headers=headers
    )
    print(f"Response: {response.json()['response']}")
    
    # 4. Create a file
    print("\n4️⃣  Creating a file...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={"command": "create a file main.py in my user directory", "history": []},
        headers=headers
    )
    print(f"Response: {response.json()['response']}")
    
    # 5. Write to file
    print("\n5️⃣  Writing code to file...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={"command": "write 'print(\"Hello WIT!\")' to main.py", "history": []},
        headers=headers
    )
    print(f"Response: {response.json()['response']}")
    
    # 6. Read file
    print("\n6️⃣  Reading file content...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={"command": "show me the contents of main.py", "history": []},
        headers=headers
    )
    print(f"Response: {response.json()['response']}")
    
    # 7. AI Query
    print("\n7️⃣  Testing AI capabilities...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/ai-query",
        json={"query": "What is the best temperature for printing PLA?"},
        headers=headers
    )
    if response.status_code == 200:
        data = response.json()
        print(f"AI Response ({data['provider']}): {data['response']}")
    else:
        print(f"AI query not available: {response.status_code}")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe WIT platform provides:")
    print("- Natural language terminal for all operations")
    print("- Project management with automatic folder creation")
    print("- File operations with proper permissions")
    print("- AI integration for general queries")
    print("- Real-time updates via WebSocket")

if __name__ == "__main__":
    main()