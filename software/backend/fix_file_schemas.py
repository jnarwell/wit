#!/usr/bin/env python3
"""Add all missing file schemas"""

import re

# Read the router to find all imports
with open("routers/files.py", "r") as f:
    content = f.read()

# Extract imports
match = re.search(r'from schemas\.file_schemas import \((.*?)\)', content, re.DOTALL)
if match:
    imports = match.group(1).replace('\n', ' ').replace(',', ' ').split()
    imports = [i.strip() for i in imports if i.strip()]
    print(f"Found imports: {imports}")
    
    # Read current schemas
    with open("schemas/file_schemas.py", "r") as f:
        schema_content = f.read()
    
    # Find missing ones
    missing = []
    for imp in imports:
        if f"class {imp}" not in schema_content:
            missing.append(imp)
    
    if missing:
        print(f"Missing schemas: {missing}")
        
        # Add them
        additions = "\n# Additional schemas for files router\n"
        
        for schema in missing:
            if schema == "FileVersionResponse":
                additions += '''
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
'''
            elif schema == "FileUpdate":
                additions += '''
class FileUpdate(BaseModel):
    """Update file metadata"""
    filename: Optional[str] = None
    description: Optional[str] = None
'''
            elif schema == "FileMove":
                additions += '''
class FileMove(BaseModel):
    """Move file to different project"""
    project_id: int
'''
            elif schema == "FileSearchParams":
                additions += '''
class FileSearchParams(BaseModel):
    """Search parameters for files"""
    search: Optional[str] = None
    file_type: Optional[str] = None
    uploaded_by: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
'''
            elif schema == "FileBulkOperation":
                additions += '''
class FileBulkOperation(BaseModel):
    """Bulk file operations"""
    file_ids: List[int]
    operation: str  # 'delete', 'move', 'archive'
    target_project_id: Optional[int] = None
'''
            else:
                # Generic schema
                additions += f'''
class {schema}(BaseModel):
    """Auto-generated schema for {schema}"""
    # TODO: Add proper fields
    data: Optional[dict] = None
'''
        
        # Check if we need to update imports
        if "List" in additions:
            lines = open("schemas/file_schemas.py").readlines()
            for i, line in enumerate(lines):
                if line.startswith("from typing import"):
                    if "List" not in line:
                        current_imports = line.strip().replace("from typing import ", "").split(", ")
                        current_imports.append("List")
                        lines[i] = f"from typing import {', '.join(sorted(current_imports))}\n"
                        with open("schemas/file_schemas.py", "w") as f:
                            f.writelines(lines)
                        break
                elif line.startswith("from datetime import"):
                    if i == 0 or not any("from typing import" in l for l in lines[:i]):
                        lines.insert(i, "from typing import Optional, List\n")
                        with open("schemas/file_schemas.py", "w") as f:
                            f.writelines(lines)
                        break
        
        with open("schemas/file_schemas.py", "a") as f:
            f.write(additions)
        
        print(f"✅ Added {len(missing)} missing schemas")
    else:
        print("✅ All schemas already exist")
