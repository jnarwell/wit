#!/usr/bin/env python3
"""
Fix route prefix duplication in dev_server.py
"""

import re

print("🔧 Fixing Route Prefix Duplication...")

# Read dev_server.py
with open('dev_server.py', 'r') as f:
    content = f.read()

# Backup
with open('dev_server.py.route_backup', 'w') as f:
    f.write(content)
print("✓ Created backup: dev_server.py.route_backup")

# Find all router includes
print("\n🔍 Finding router includes...")

# Pattern to match router includes
pattern = r'app\.include_router\(([\w.]+)\.router,\s*prefix="([^"]+)"(?:,\s*tags=\[(.*?)\])?\)'

matches = list(re.finditer(pattern, content))
print(f"Found {len(matches)} router includes")

# Fix duplicated prefixes
fixed_content = content
changes = []

for match in matches:
    full_match = match.group(0)
    router_name = match.group(1)
    prefix = match.group(2)
    tags = match.group(3)
    
    # Check if prefix contains duplication
    if '/api/v1/projects' in prefix and router_name in ['projects', 'tasks', 'teams', 'materials', 'files']:
        # These should just be /api/v1/{router_name}
        new_prefix = f"/api/v1/{router_name}"
        
        if tags:
            new_include = f'app.include_router({router_name}.router, prefix="{new_prefix}", tags=[{tags}])'
        else:
            new_include = f'app.include_router({router_name}.router, prefix="{new_prefix}")'
        
        fixed_content = fixed_content.replace(full_match, new_include)
        changes.append(f"  {router_name}: {prefix} → {new_prefix}")

print(f"\n📝 Fixed {len(changes)} router prefixes:")
for change in changes:
    print(change)

# Write fixed content
with open('dev_server.py', 'w') as f:
    f.write(fixed_content)

print("\n✅ Route prefixes fixed!")
print("\nRestart the server to apply changes:")
print("  python3 dev_server.py")