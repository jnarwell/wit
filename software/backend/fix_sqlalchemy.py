#!/usr/bin/env python3
"""
Fix for SQLAlchemy duplicate model registration issue
"""

import os
import sys

def fix_duplicate_models():
    """
    The issue is that models are defined in multiple places:
    1. services/database_services.py - main models (User, Project, etc.)
    2. models/microcontroller.py - microcontroller models (SensorReading, etc.)
    
    Both import from the same Base, causing duplicate registrations.
    
    Solution: Move all models to one location or ensure proper import order.
    """
    
    print("SQLAlchemy Duplicate Model Fix")
    print("=" * 50)
    print("\nThe error 'Multiple classes found for path \"SensorReading\"' occurs because:")
    print("1. Models are defined in multiple files")
    print("2. Both files use the same declarative Base")
    print("3. Models get registered multiple times")
    
    print("\nQuick Fix Options:")
    print("\n1. **Use the dev_server.py instead** (RECOMMENDED)")
    print("   - Already working and doesn't use SQLAlchemy")
    print("   - Run: python dev_server.py")
    
    print("\n2. **Disable microcontroller models temporarily**")
    print("   - Comment out the import in models/__init__.py")
    
    print("\n3. **Move all models to one file**")
    print("   - Consolidate models into services/database_services.py")
    
    print("\nTo implement option 2 (quick fix):")
    
    # Read the models/__init__.py file
    init_file = "/Users/jmarwell/Documents/wit/software/backend/models/__init__.py"
    if os.path.exists(init_file):
        with open(init_file, 'r') as f:
            content = f.read()
        
        # Comment out the microcontroller imports
        new_content = content.replace(
            "from .microcontroller import Microcontroller, SensorReading, DeviceLog",
            "# from .microcontroller import Microcontroller, SensorReading, DeviceLog  # Commented to fix duplicate model issue"
        )
        new_content = new_content.replace(
            "    'Microcontroller',\n    'SensorReading', \n    'DeviceLog'",
            "    # 'Microcontroller',\n    # 'SensorReading', \n    # 'DeviceLog'"
        )
        
        # Write back
        with open(init_file, 'w') as f:
            f.write(new_content)
        
        print(f"\n✅ Fixed {init_file}")
        print("   - Commented out microcontroller model imports")
        print("\nNow try running the frontend server again.")
    else:
        print(f"\n❌ Could not find {init_file}")

if __name__ == "__main__":
    fix_duplicate_models()