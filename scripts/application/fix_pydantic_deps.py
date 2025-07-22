#!/usr/bin/env python3
"""
Fix pydantic dependency conflict in W.I.T. backend
"""

import subprocess
import sys
import os

def main():
    print("🔧 Fixing pydantic dependency conflict...")
    
    # Ensure we're in the backend directory
    if not os.path.exists("requirements.txt"):
        print("❌ Error: Please run this script from the software/backend directory")
        sys.exit(1)
    
    # First, uninstall conflicting packages
    print("\n📦 Uninstalling conflicting packages...")
    subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "pydantic", "pydantic-core", "pydantic-settings"])
    
    # Install compatible versions
    print("\n📦 Installing compatible versions...")
    packages = [
        "pydantic==2.10.1",  # Updated to match pydantic-settings requirement
        "pydantic-settings==2.10.1",
        "pydantic-core==2.33.2"  # Compatible core version
    ]
    
    for package in packages:
        print(f"Installing {package}...")
        subprocess.run([sys.executable, "-m", "pip", "install", package])
    
    # Update requirements.txt
    print("\n📝 Updating requirements.txt...")
    with open("requirements.txt", "r") as f:
        lines = f.readlines()
    
    # Update pydantic version
    updated_lines = []
    for line in lines:
        if line.startswith("pydantic=="):
            updated_lines.append("pydantic==2.10.1\n")
        elif line.startswith("pydantic-settings") and "pydantic-settings" not in line:
            # Add pydantic-settings if missing
            updated_lines.append(line)
            updated_lines.append("pydantic-settings==2.10.1\n")
        else:
            updated_lines.append(line)
    
    # Add pydantic-settings if not present at all
    if not any("pydantic-settings" in line for line in updated_lines):
        updated_lines.append("pydantic-settings==2.10.1\n")
    
    with open("requirements.txt", "w") as f:
        f.writelines(updated_lines)
    
    print("\n✅ Dependencies fixed!")
    
    # Test the fix
    print("\n🧪 Testing imports...")
    try:
        import pydantic
        import pydantic_settings
        from config import settings
        print("✅ All imports successful!")
        print(f"   - pydantic version: {pydantic.__version__}")
        print(f"   - pydantic_settings available: Yes")
    except Exception as e:
        print(f"❌ Import test failed: {e}")
        return 1
    
    print("\n🎯 Now you can run: python3 init_database.py")
    return 0

if __name__ == "__main__":
    sys.exit(main())