#!/usr/bin/env python3
"""Fix relative imports in router files"""

import os
import re

def fix_imports_in_file(filepath):
    """Fix relative imports in a Python file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace relative imports with absolute imports
    replacements = [
        (r'from \.\.services\.database_services', 'from services.database_services'),
        (r'from \.\.services\.', 'from services.'),
        (r'from \.\.models\.', 'from models.'),
        (r'from \.\.schemas\.', 'from schemas.'),
        (r'from \.\.core\.', 'from core.'),
    ]
    
    modified = False
    for pattern, replacement in replacements:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            modified = True
    
    if modified:
        # Backup original
        backup_path = filepath + '.backup'
        os.rename(filepath, backup_path)
        
        # Write fixed version
        with open(filepath, 'w') as f:
            f.write(content)
        
        print(f"✅ Fixed imports in {filepath}")
        return True
    return False

# Fix all router files
router_dir = "routers"
if os.path.exists(router_dir):
    for filename in os.listdir(router_dir):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(router_dir, filename)
            fix_imports_in_file(filepath)

print("\n🚀 Now try running: python dev_server.py")
