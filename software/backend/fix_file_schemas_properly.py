#!/usr/bin/env python3
"""Fix file schemas properly"""

# Read the file
with open("schemas/file_schemas.py", "r") as f:
    lines = f.readlines()

# Remove the invalid 'as' class
output_lines = []
skip_next = False
for i, line in enumerate(lines):
    if "class as(BaseModel):" in line:
        # Skip this class and the next few lines
        skip_next = True
        continue
    elif skip_next and line.strip() and not line.startswith("class"):
        continue
    elif skip_next and line.startswith("class"):
        skip_next = False
    
    if not skip_next:
        output_lines.append(line)

# Also remove FileResponseSchema if it exists (it's just an alias)
final_lines = []
skip_next = False
for line in output_lines:
    if "class FileResponseSchema(BaseModel):" in line:
        skip_next = True
        continue
    elif skip_next and line.strip() and not line.startswith("class"):
        continue
    elif skip_next and line.startswith("class"):
        skip_next = False
    
    if not skip_next:
        final_lines.append(line)

# Write back
with open("schemas/file_schemas.py", "w") as f:
    f.writelines(final_lines)

print("✅ Fixed file schemas")

# Now add the properly missing schemas
missing_schemas = """
class FileVersionResponse(BaseModel):
    """File version response"""
    id: int
    file_id: int
    version_number: int
    file_size: int
    uploaded_by: int
    uploaded_at: datetime
    change_notes: Optional[str] = None
    is_current: bool
    
    class Config:
        from_attributes = True

class FileMoveRequest(BaseModel):
    """Request to move file to different project"""
    target_project_id: int

class FileUpdateRequest(BaseModel):
    """Request to update file metadata"""
    filename: Optional[str] = None
    description: Optional[str] = None

class FileShareRequest(BaseModel):
    """Request to share file"""
    user_ids: Optional[List[int]] = []
    team_ids: Optional[List[int]] = []
    access_level: str = "read"  # 'read', 'write'
    expires_at: Optional[datetime] = None
"""

# Check what's actually missing and add only those
with open("schemas/file_schemas.py", "r") as f:
    content = f.read()

schemas_to_add = []
for schema in ["FileVersionResponse", "FileMoveRequest", "FileUpdateRequest", "FileShareRequest"]:
    if f"class {schema}" not in content:
        # Extract just this schema from missing_schemas
        start = missing_schemas.find(f"class {schema}")
        if start != -1:
            end = missing_schemas.find("\nclass ", start + 1)
            if end == -1:
                schema_def = missing_schemas[start:]
            else:
                schema_def = missing_schemas[start:end]
            schemas_to_add.append(schema_def.strip())

if schemas_to_add:
    with open("schemas/file_schemas.py", "a") as f:
        f.write("\n\n# File operation schemas\n")
        f.write("\n\n".join(schemas_to_add))
    print(f"✅ Added {len(schemas_to_add)} properly formatted schemas")
