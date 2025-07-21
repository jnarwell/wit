#!/usr/bin/env python3
"""Add all missing schemas that routers expect"""

# Read what's currently imported in projects router
with open("routers/projects.py", "r") as f:
    content = f.read()

# Find the import statement
import re
match = re.search(r'from schemas\.project_schemas import \((.*?)\)', content, re.DOTALL)

if match:
    imports = match.group(1).replace('\n', ' ').replace(',', ' ').split()
    imports = [i.strip() for i in imports if i.strip()]
    print(f"Found imports: {imports}")
    
    # Check what's missing
    with open("schemas/project_schemas.py", "r") as f:
        schema_content = f.read()
    
    missing = []
    for import_name in imports:
        if f"class {import_name}" not in schema_content:
            missing.append(import_name)
    
    if missing:
        print(f"\nMissing schemas: {missing}")
        
        # Add missing schemas
        additions = """
# Additional schemas for router compatibility
"""
        
        if "ProjectDetailResponse" in missing:
            additions += """
class ProjectDetailResponse(ProjectResponse):
    \"\"\"Detailed project response with additional information\"\"\"
    tasks_count: int = 0
    team_members: List[str] = []
    completion_percentage: float = 0.0
    last_activity: Optional[datetime] = None
    tags: List[str] = []
    files_count: int = 0
"""
        
        # Add any other missing schemas with sensible defaults
        for schema in missing:
            if schema not in ["ProjectDetailResponse"]:
                additions += f"""
class {schema}(BaseModel):
    \"\"\"Auto-generated schema for {schema}\"\"\"
    # TODO: Add proper fields
    pass
"""
        
        with open("schemas/project_schemas.py", "a") as f:
            f.write(additions)
        
        print(f"✅ Added missing schemas: {missing}")
    else:
        print("✅ All schemas already exist!")
else:
    print("❌ Could not find import statement")

print("\n🚀 Try running: python3 dev_server.py")
