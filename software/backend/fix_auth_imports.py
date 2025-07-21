#!/usr/bin/env python3
"""Fix auth import issues in routers"""

import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix the auth import
    content = content.replace(
        'from ..auth.dependencies import get_current_user',
        'from auth.dependencies import get_current_user'
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    return True

# Fix all router files
for file in os.listdir('routers'):
    if file.endswith('.py') and file != '__init__.py':
        filepath = os.path.join('routers', file)
        if fix_file(filepath):
            print(f"✅ Fixed {filepath}")

print("\n🚀 Now trying to run the server...")
