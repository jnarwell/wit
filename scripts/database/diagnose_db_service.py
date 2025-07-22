#!/usr/bin/env python3
"""
Diagnose the database service to understand its actual structure
"""

import sys
import os
import importlib.util

def main():
    print("🔍 Diagnosing Database Service Structure")
    print("=" * 50)
    
    # First, let's look at the actual database_services.py file
    db_service_path = "services/database_services.py"
    
    if os.path.exists(db_service_path):
        print(f"\n📄 Found {db_service_path}")
        print("\nSearching for initialization methods...")
        
        with open(db_service_path, 'r') as f:
            content = f.read()
            
        # Look for initialization patterns
        patterns = [
            "def init",
            "async def init",
            "def __init__",
            "class DatabaseService",
            "init_database",
            "get_session",
            "SessionLocal",
            "async_session"
        ]
        
        for pattern in patterns:
            if pattern in content:
                # Find the line
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if pattern in line and not line.strip().startswith('#'):
                        print(f"\n✓ Found '{pattern}':")
                        # Print context (3 lines before and after)
                        start = max(0, i-1)
                        end = min(len(lines), i+4)
                        for j in range(start, end):
                            prefix = ">>>" if j == i else "   "
                            print(f"{prefix} {lines[j]}")
    
    # Now let's actually import and inspect
    print("\n\n📦 Importing and inspecting database service...")
    
    try:
        from services.database_services import db_service
        
        print("\n✓ Successfully imported db_service")
        print(f"  Type: {type(db_service)}")
        print(f"  Module: {db_service.__class__.__module__}")
        
        print("\n📋 Available attributes and methods:")
        for attr in sorted(dir(db_service)):
            if not attr.startswith('_'):
                try:
                    value = getattr(db_service, attr)
                    value_type = type(value).__name__
                    print(f"  - {attr}: {value_type}")
                except:
                    print(f"  - {attr}: <unable to access>")
        
        # Check for specific attributes
        print("\n🔍 Checking specific attributes:")
        checks = [
            ('init', 'Initialization method'),
            ('initialize', 'Initialize method'),
            ('get_session', 'Session getter'),
            ('SessionLocal', 'Session factory'),
            ('engine', 'Database engine'),
            ('async_session', 'Async session maker')
        ]
        
        for attr, desc in checks:
            if hasattr(db_service, attr):
                print(f"  ✓ Has {attr} ({desc})")
            else:
                print(f"  ✗ Missing {attr} ({desc})")
                
    except Exception as e:
        print(f"\n❌ Error importing db_service: {e}")
    
    # Also check for standalone init_database function
    print("\n\n🔍 Looking for standalone init_database function...")
    try:
        from services.database_services import init_database
        print("✓ Found init_database function!")
        print(f"  Type: {type(init_database)}")
        
        # Check its signature
        import inspect
        sig = inspect.signature(init_database)
        print(f"  Signature: {sig}")
        
    except ImportError:
        print("✗ No standalone init_database function found")
    
    # Look for database service patterns
    print("\n\n📋 Database Service Pattern Analysis:")
    if os.path.exists(db_service_path):
        with open(db_service_path, 'r') as f:
            content = f.read()
            
        # Check if it's a singleton pattern
        if "instance" in content or "_instance" in content:
            print("✓ Appears to use singleton pattern")
            
        # Check for async context manager
        if "__aenter__" in content or "async with" in content:
            print("✓ Supports async context manager")
            
        # Check initialization pattern
        if "def __init__" in content:
            print("✓ Has __init__ method")
            
        # Find the actual initialization method
        import re
        
        # Look for any init-like methods
        init_methods = re.findall(r'(async\s+)?def\s+(\w*init\w*)\s*\(', content)
        if init_methods:
            print("\n✓ Found initialization methods:")
            for async_marker, method_name in init_methods:
                async_text = "async " if async_marker else ""
                print(f"  - {async_text}{method_name}()")

if __name__ == "__main__":
    main()