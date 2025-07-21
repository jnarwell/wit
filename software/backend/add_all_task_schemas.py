#!/usr/bin/env python3
"""Add all missing task schemas"""

import re

# Read the router file to get all imports
with open("routers/tasks.py", "r") as f:
    content = f.read()

# Extract all imports from task_schemas
match = re.search(r'from schemas\.task_schemas import \((.*?)\)', content, re.DOTALL)
if match:
    imports = match.group(1).replace('\n', ' ').replace(',', ' ').split()
    imports = [i.strip() for i in imports if i.strip()]
    print(f"Found imports: {imports}")
    
    # Read current schemas
    with open("schemas/task_schemas.py", "r") as f:
        schema_content = f.read()
    
    # Find missing ones
    missing = []
    for imp in imports:
        if f"class {imp}" not in schema_content:
            missing.append(imp)
    
    if missing:
        print(f"Missing schemas: {missing}")
        
        # Add them
        additions = "\n# Additional schemas for tasks router\n"
        
        for schema in missing:
            if schema == "TaskMoveRequest":
                additions += '''
class TaskMoveRequest(BaseModel):
    """Request schema for moving a task"""
    project_id: Optional[int] = None
    new_position: Optional[int] = None
    new_status: Optional[TaskStatus] = None
'''
            elif schema == "TaskAssignRequest":
                additions += '''
class TaskAssignRequest(BaseModel):
    """Request schema for assigning a task"""
    user_id: Optional[int] = None
    notify: bool = True
    notes: Optional[str] = None
'''
            elif schema == "TaskBulkRequest":
                additions += '''
class TaskBulkRequest(BaseModel):
    """Request schema for bulk task operations"""
    task_ids: List[int]
    operation: str
    parameters: Optional[Dict[str, Any]] = None
'''
            else:
                # Generic schema
                additions += f'''
class {schema}(BaseModel):
    """Auto-generated schema for {schema}"""
    # TODO: Add proper fields
    data: Optional[Dict[str, Any]] = None
'''
        
        with open("schemas/task_schemas.py", "a") as f:
            f.write(additions)
        
        print(f"✅ Added {len(missing)} missing schemas")
    else:
        print("✅ All schemas already exist")
