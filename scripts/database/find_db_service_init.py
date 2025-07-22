#!/usr/bin/env python3
"""
Find how db_service is instantiated
"""

import os

def main():
    print("🔍 Finding db_service instantiation")
    print("=" * 40)
    
    # Look at the end of database_services.py
    db_service_file = "services/database_services.py"
    
    if os.path.exists(db_service_file):
        with open(db_service_file, 'r') as f:
            lines = f.readlines()
        
        print(f"\n📄 Checking {db_service_file}...")
        print("\nLast 50 lines of file:")
        print("-" * 40)
        
        # Show the last 50 lines where db_service is likely instantiated
        for i, line in enumerate(lines[-50:], start=len(lines)-50):
            if 'db_service' in line and '=' in line:
                print(f">>> Line {i+1}: {line.rstrip()}")
            elif line.strip() and not line.strip().startswith('#'):
                print(f"    Line {i+1}: {line.rstrip()}")
    
    # Also check how it's imported in other files
    print("\n\n📄 Checking imports in other files...")
    
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['venv', '__pycache__', '.git']]
        
        for file in files:
            if file.endswith('.py') and file != 'find_db_service_init.py':
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r') as f:
                        content = f.read()
                    
                    if 'from services.database_services import db_service' in content:
                        print(f"\n✓ {filepath} imports db_service")
                        
                        # Check if it's re-initialized
                        lines = content.split('\n')
                        for i, line in enumerate(lines):
                            if 'db_service' in line and ('=' in line or 'init' in line or 'connect' in line):
                                print(f"  Line {i+1}: {line.strip()}")
                                
                except:
                    pass

if __name__ == "__main__":
    main()