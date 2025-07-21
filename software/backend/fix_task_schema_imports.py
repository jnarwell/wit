#!/usr/bin/env python3
"""Fix imports in task_schemas.py"""

with open("schemas/task_schemas.py", "r") as f:
    lines = f.readlines()

# Check if we have the proper imports
has_dict = False
has_list = False
has_any = False

for line in lines:
    if "from typing import" in line:
        if "Dict" in line:
            has_dict = True
        if "List" in line:
            has_list = True
        if "Any" in line:
            has_any = True

# If missing, update the import line
if not has_dict or not has_list or not has_any:
    for i, line in enumerate(lines):
        if line.startswith("from typing import"):
            # Parse current imports
            current_imports = line.strip().replace("from typing import ", "").split(", ")
            
            # Add missing imports
            if not has_dict and "Dict" not in current_imports:
                current_imports.append("Dict")
            if not has_list and "List" not in current_imports:
                current_imports.append("List")
            if not has_any and "Any" not in current_imports:
                current_imports.append("Any")
            
            # Rebuild the import line
            lines[i] = f"from typing import {', '.join(sorted(current_imports))}\n"
            break
    else:
        # No typing import found, add it
        lines.insert(2, "from typing import Optional, List, Dict, Any\n")

# Write back
with open("schemas/task_schemas.py", "w") as f:
    f.writelines(lines)

print("✅ Fixed imports in task_schemas.py")
