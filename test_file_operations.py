#!/usr/bin/env python3
"""Test script for file operations after backend fixes"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1/files"

def test_user_files():
    """Test getting user files - paths should not include 'default_user'"""
    print("\n1. Testing GET /user endpoint...")
    response = requests.get(f"{BASE_URL}/user")
    if response.status_code == 200:
        files = response.json()
        print(f"   ✓ Got {len(files)} files")
        for f in files[:3]:  # Show first 3
            print(f"     - {f['path']} (should not start with 'default_user/')")
    else:
        print(f"   ✗ Failed: {response.status_code}")

def test_create_file():
    """Test creating a file"""
    print("\n2. Testing file creation...")
    test_name = f"test_{int(time.time())}.md"
    data = {
        "path": test_name,
        "base_dir": "user",
        "project_id": ""
    }
    response = requests.post(f"{BASE_URL}/create", json=data)
    if response.status_code == 200:
        file_info = response.json()
        print(f"   ✓ Created file: {file_info['path']}")
        return file_info['path']
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")
        return None

def test_file_content(file_path):
    """Test viewing file content"""
    print("\n3. Testing file content viewing...")
    params = {
        "path": file_path,
        "base_dir": "user",
        "project_id": ""
    }
    response = requests.get(f"{BASE_URL}/content", params=params)
    if response.status_code == 200:
        content_data = response.json()
        print(f"   ✓ Got content for: {content_data['path']}")
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")

def test_update_file(file_path):
    """Test updating file content"""
    print("\n4. Testing file update...")
    data = {
        "path": file_path,
        "content": "# Test Content\\n\\nThis is a test file.",
        "base_dir": "user",
        "project_id": ""
    }
    response = requests.put(f"{BASE_URL}/update", json=data)
    if response.status_code == 200:
        print(f"   ✓ Updated file successfully")
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")

def test_rename_file(file_path):
    """Test renaming a file"""
    print("\n5. Testing file rename...")
    new_name = file_path.replace('.md', '_renamed.md')
    data = {
        "old_path": file_path,
        "new_path": new_name,
        "base_dir": "user",
        "project_id": ""
    }
    response = requests.post(f"{BASE_URL}/rename", json=data)
    if response.status_code == 200:
        file_info = response.json()
        print(f"   ✓ Renamed to: {file_info['file']['path']}")
        return file_info['file']['path']
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")
        return file_path

def test_upload_file():
    """Test file upload"""
    print("\n6. Testing file upload...")
    files = {'file': ('upload_test.txt', 'Uploaded content', 'text/plain')}
    data = {
        'path': 'uploads',
        'base_dir': 'user',
        'project_id': ''
    }
    response = requests.post(f"{BASE_URL}/upload", files=files, data=data)
    if response.status_code == 200:
        file_info = response.json()
        print(f"   ✓ Uploaded file: {file_info['file']['path']}")
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")

def test_delete_file(file_path):
    """Test deleting a file"""
    print("\n7. Testing file deletion...")
    data = {
        "path": file_path,
        "base_dir": "user",
        "project_id": ""
    }
    response = requests.post(f"{BASE_URL}/delete", json=data)
    if response.status_code == 200:
        print(f"   ✓ Deleted file successfully")
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")

def test_project_files():
    """Test project file operations"""
    print("\n8. Testing project files...")
    project_id = "PROJ-0001"
    
    # Create a project file
    data = {
        "path": "project_test.md",
        "base_dir": "project",
        "project_id": project_id
    }
    response = requests.post(f"{BASE_URL}/create", json=data)
    if response.status_code == 200:
        file_info = response.json()
        print(f"   ✓ Created project file: {file_info['path']}")
    else:
        print(f"   ✗ Failed to create project file: {response.status_code}")

if __name__ == "__main__":
    print("=== File Operations Test Suite ===")
    print("Make sure the backend is running with the latest changes!")
    
    # Run tests
    test_user_files()
    
    # Create and test a file
    file_path = test_create_file()
    if file_path:
        test_file_content(file_path)
        test_update_file(file_path)
        file_path = test_rename_file(file_path)
        test_delete_file(file_path)
    
    test_upload_file()
    test_project_files()
    
    print("\n=== Test Suite Complete ===")