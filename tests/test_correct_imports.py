#!/usr/bin/env python3
"""
Test with correct file names
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def test_service_imports():
    """Test importing services with correct names"""
    print("Testing service imports with correct filenames...")
    
    # Test database_services
    try:
        from software.backend.services.database_services import DatabaseService
        print("✓ DatabaseService imported from database_services.py")
    except ImportError as e:
        print(f"✗ Failed to import DatabaseService: {e}")
    
    # Test auth_services
    try:
        from software.backend.services.auth_services import AuthService, auth_router
        print("✓ AuthService imported from auth_services.py")
    except ImportError as e:
        print(f"✗ Failed to import AuthService: {e}")
    
    # Test vision_processor (after rename)
    try:
        from software.ai.vision.vision_processor import VisionProcessor
        print("✓ VisionProcessor imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import VisionProcessor: {e}")
    
    # Test other services
    try:
        from software.backend.services.mqtt_service import MQTTService
        print("✓ MQTTService imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import MQTTService: {e}")
    
    try:
        from software.backend.services.event_service import EventService
        print("✓ EventService imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import EventService: {e}")

def test_minimal_app():
    """Test creating a minimal FastAPI app"""
    print("\nTesting minimal FastAPI app...")
    
    try:
        from fastapi import FastAPI
        app = FastAPI(title="W.I.T. Test")
        
        # Add a test route
        @app.get("/test")
        def test_route():
            return {"status": "working"}
        
        print("✓ Minimal FastAPI app created successfully")
        
        # Test with test client
        from fastapi.testclient import TestClient
        client = TestClient(app)
        response = client.get("/test")
        assert response.status_code == 200
        print("✓ Test endpoint works")
        
    except Exception as e:
        print(f"✗ Failed to create app: {e}")

if __name__ == "__main__":
    test_service_imports()
    test_minimal_app()