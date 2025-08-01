#!/usr/bin/env python3
"""
Test script for WIT API functionality
Tests project management, terminal commands, and file operations
"""

import requests
import json
import time
from typing import Optional

BASE_URL = "http://localhost:8000"

class WITAPITester:
    def __init__(self):
        self.token = None
        self.headers = {}
        
    def login(self, username: str = "admin", password: str = "admin") -> bool:
        """Login and get access token"""
        print(f"🔐 Logging in as {username}...")
        
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/token",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            print("✅ Login successful!")
            return True
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
    
    def test_project_api(self):
        """Test project CRUD operations"""
        print("\n📁 Testing Project API...")
        
        # Create project
        project_data = {
            "name": "AI Terminal Test Project",
            "description": "Testing the new WIT API functionality",
            "type": "software",
            "status": "in_progress",
            "priority": "high"
        }
        
        print("Creating project...")
        response = requests.post(
            f"{BASE_URL}/api/v1/projects/",
            json=project_data,
            headers=self.headers
        )
        
        if response.status_code == 200:
            project = response.json()
            print(f"✅ Project created: {project['project_id']}")
            
            # List projects
            print("\nListing projects...")
            list_response = requests.get(
                f"{BASE_URL}/api/v1/projects/",
                headers=self.headers
            )
            
            if list_response.status_code == 200:
                projects = list_response.json()
                print(f"✅ Found {projects['total']} projects")
                
                # Get project details
                print(f"\nGetting project details for {project['project_id']}...")
                detail_response = requests.get(
                    f"{BASE_URL}/api/v1/projects/{project['project_id']}",
                    headers=self.headers
                )
                
                if detail_response.status_code == 200:
                    details = detail_response.json()
                    print(f"✅ Project details retrieved:")
                    print(f"   - Tasks: {details['statistics']['total_tasks']}")
                    print(f"   - Files: {details['statistics']['file_count']}")
                    print(f"   - Team: {len(details['team_members'])} members")
                else:
                    print(f"❌ Failed to get project details: {detail_response.status_code}")
            else:
                print(f"❌ Failed to list projects: {list_response.status_code}")
                
            return project['project_id']
        else:
            print(f"❌ Failed to create project: {response.status_code} - {response.text}")
            return None
    
    def test_terminal_api(self, project_id: Optional[str] = None):
        """Test terminal command processing"""
        print("\n💻 Testing Terminal API...")
        
        # Test basic command
        command_data = {
            "command": "help",
            "history": []
        }
        
        print("Sending 'help' command...")
        response = requests.post(
            f"{BASE_URL}/api/v1/terminal/command",
            json=command_data,
            headers=self.headers
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Command processed in {result['execution_time']:.2f}s")
            print(f"   Response preview: {result['response'][:100]}...")
        else:
            print(f"❌ Command failed: {response.status_code} - {response.text}")
        
        # Test project creation via terminal
        if project_id:
            command_data = {
                "command": f"create a task 'Implement login system' in project {project_id}",
                "history": []
            }
            
            print(f"\nCreating task via terminal...")
            response = requests.post(
                f"{BASE_URL}/api/v1/terminal/command",
                json=command_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Task creation command processed")
            else:
                print(f"❌ Task creation failed: {response.status_code}")
        
        # Test AI query
        ai_query_data = {
            "query": "What is the square root of 144?",
            "context": "Math calculation"
        }
        
        print("\nTesting AI query endpoint...")
        response = requests.post(
            f"{BASE_URL}/api/v1/terminal/ai-query",
            json=ai_query_data,
            headers=self.headers
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ AI query successful")
            print(f"   Provider: {result['provider']}")
            print(f"   Response: {result['response']}")
        else:
            print(f"❌ AI query failed: {response.status_code}")
    
    def test_system_status(self):
        """Test system status endpoint"""
        print("\n🔍 Testing System Status...")
        
        response = requests.get(
            f"{BASE_URL}/api/v1/terminal/status",
            headers=self.headers
        )
        
        if response.status_code == 200:
            status = response.json()
            print(f"✅ System status: {status['status']}")
            print("   Services:")
            for service, is_up in status['services'].items():
                status_icon = "✅" if is_up else "❌"
                print(f"     {status_icon} {service}")
        else:
            print(f"❌ Failed to get system status: {response.status_code}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting WIT API Tests\n")
        
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return
        
        self.test_system_status()
        project_id = self.test_project_api()
        self.test_terminal_api(project_id)
        
        print("\n✨ Test suite completed!")

if __name__ == "__main__":
    tester = WITAPITester()
    tester.run_all_tests()