#!/usr/bin/env python3
"""Fix the imports in dev_server.py"""

import os

# Read the current dev_server.py
with open("dev_server.py", "r") as f:
    content = f.read()

# Check if fix already applied
if "sys.path.insert" in content:
    print("✅ Import fix already applied!")
    exit(0)

# Find where to insert (after the docstring)
lines = content.split('\n')
insert_index = 0

# Skip shebang and docstring
for i, line in enumerate(lines):
    if i == 0 and line.startswith("#!"):
        continue
    if line.strip().startswith('"""') and i > 0:
        # Find the closing docstring
        for j in range(i+1, len(lines)):
            if '"""' in lines[j]:
                insert_index = j + 1
                break
        break
    elif not line.strip().startswith('"""') and not line.startswith("#!"):
        insert_index = i
        break

# Insert the fix
fix_code = [
    "",
    "import sys",
    "import os",
    "# Fix imports by adding current directory to Python path",
    "sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))",
    ""
]

lines[insert_index:insert_index] = fix_code

# Write back
with open("dev_server.py", "w") as f:
    f.write('\n'.join(lines))

print("✅ Fixed imports in dev_server.py!")
print("🚀 Now run: python dev_server.py")
