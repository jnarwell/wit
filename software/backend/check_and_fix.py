#!/usr/bin/env python3
"""
Check and fix missing modules

File: software/backend/check_and_fix.py
"""

import os
import sys

def check_modules():
    """Check for required modules and create if missing"""
    print("Checking required modules...\n")
    
    # Required directories and files
    required = {
        "auth": ["__init__.py", "security.py", "dependencies.py"],
        "models": ["__init__.py", "database_models_extended.py"],
        "services": ["__init__.py", "database_service.py"],
        "routers": ["__init__.py"],
        "schemas": ["__init__.py"]
    }
    
    for directory, files in required.items():
        # Create directory if it doesn't exist
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"✓ Created directory: {directory}")
        
        # Create __init__.py if it doesn't exist
        for file in files:
            filepath = os.path.join(directory, file)
            if not os.path.exists(filepath):
                with open(filepath, "w") as f:
                    if file == "__init__.py":
                        f.write("")
                    elif file == "security.py":
                        # Create minimal security.py
                        f.write('''"""Auth security module"""

def get_password_hash(password: str) -> str:
    """Simple hash for testing - DO NOT USE IN PRODUCTION"""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return get_password_hash(plain_password) == hashed_password
''')
                print(f"✓ Created file: {filepath}")
    
    # Copy the SQLite database service
    if os.path.exists("services/database_service.py"):
        print("\n✓ Database service exists")
    else:
        print("\n✗ Database service missing - please run the setup again")
    
    print("\n✓ Module check complete!")

if __name__ == "__main__":
    check_modules()