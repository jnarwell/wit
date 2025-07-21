#!/usr/bin/env python3
"""Fix imports in database_models.py"""

with open("models/database_models.py", "r") as f:
    content = f.read()

# Check what needs to be imported
needs_relationship = "relationship" not in content
needs_unique = "UniqueConstraint" not in content

# Find the sqlalchemy import line and update it
lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith("from sqlalchemy import"):
        # Parse current imports
        imports = line.replace("from sqlalchemy import ", "").strip()
        import_list = [x.strip() for x in imports.split(',')]
        
        # Add missing imports
        if needs_unique and "UniqueConstraint" not in import_list:
            import_list.append("UniqueConstraint")
        
        # Rebuild the line
        lines[i] = f"from sqlalchemy import {', '.join(import_list)}"
        break

# Add relationship import if needed
if needs_relationship:
    for i, line in enumerate(lines):
        if "from sqlalchemy import" in line:
            lines.insert(i+1, "from sqlalchemy.orm import relationship")
            break

# Write back
with open("models/database_models.py", "w") as f:
    f.write('\n'.join(lines))

print("✅ Fixed imports in database_models.py")
