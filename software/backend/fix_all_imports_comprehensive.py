#!/usr/bin/env python3
"""Comprehensive import fixer for W.I.T. backend"""

import os
import re
from pathlib import Path

# Define all the import patterns to fix
IMPORT_FIXES = [
    # Fix relative imports
    (r'from \.\.(\.)?auth\.dependencies', 'from auth.dependencies'),
    (r'from \.\.services\.database_services', 'from services.database_services'),
    (r'from \.\.models\.', 'from models.'),
    (r'from \.\.schemas\.', 'from schemas.'),
    (r'from \.\.core\.', 'from core.'),
    
    # Fix database service import
    (r'from services\.database_services import get_session',
     'from services.database_services import get_session'),
]

def fix_imports(filepath):
    """Fix imports in a file"""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original = content
        for pattern, replacement in IMPORT_FIXES:
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        
        if content != original:
            with open(filepath, 'w') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

# Process all Python files
print("🔧 Fixing imports across the project...\n")

# Fix routers
router_files = list(Path('routers').glob('*.py'))
for file in router_files:
    if file.name != '__init__.py':
        if fix_imports(str(file)):
            print(f"✅ Fixed {file}")

# Fix services
if Path('services').exists():
    service_files = list(Path('services').glob('*.py'))
    for file in service_files:
        if fix_imports(str(file)):
            print(f"✅ Fixed {file}")

print("\n✨ Import fixes complete!")
