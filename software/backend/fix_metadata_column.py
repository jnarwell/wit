#!/usr/bin/env python3
"""Fix metadata column name in ProjectFile model"""

with open("models/database_models.py", "r") as f:
    content = f.read()

# Replace metadata with file_metadata in ProjectFile model
content = content.replace(
    "metadata = Column(JSONB, default={})",
    "file_metadata = Column(JSONB, default={})"
)

with open("models/database_models.py", "w") as f:
    f.write(content)

print("✅ Fixed metadata column name")
