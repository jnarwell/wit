#!/usr/bin/env python3
"""
Test if the FastAPI app can start
"""

import sys
import os
from pathlib import Path

# Setup path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "software"))

def test_fastapi_startup():
    """Test if FastAPI app can be imported and created"""
    print("Testing FastAPI startup...")
    
    try:
        # Try importing the app
        from backend.main import app
        print("✓ FastAPI app imported successfully")
        
        # Check app properties
        print(f"✓ App title: {app.title}")
        print(f"✓ App version: {app.version}")
        
        # Check routes
        routes = [route.path for route in app.routes]
        print(f"✓ Routes registered: {len(routes)}")
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to import app: {e}")
        return False


if __name__ == "__main__":
    success = test_fastapi_startup()
    sys.exit(0 if success else 1)