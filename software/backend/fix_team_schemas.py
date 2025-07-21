#!/usr/bin/env python3
"""Add all missing team schemas"""

import re

# Read the router to find all imports
with open("routers/teams.py", "r") as f:
    content = f.read()

# Extract imports
match = re.search(r'from schemas\.team_schemas import \((.*?)\)', content, re.DOTALL)
if match:
    imports = match.group(1).replace('\n', ' ').replace(',', ' ').split()
    imports = [i.strip() for i in imports if i.strip()]
    print(f"Found imports: {imports}")
    
    # Read current schemas
    with open("schemas/team_schemas.py", "r") as f:
        schema_content = f.read()
    
    # Find missing ones
    missing = []
    for imp in imports:
        if f"class {imp}" not in schema_content:
            missing.append(imp)
    
    if missing:
        print(f"Missing schemas: {missing}")
        
        # Add them
        additions = "\n# Additional schemas for teams router\n"
        
        for schema in missing:
            if schema == "TeamMemberUpdate":
                additions += '''
class TeamMemberUpdate(BaseModel):
    """Update team member role"""
    role: str = Field(..., min_length=1, max_length=50)
'''
            elif schema == "TeamInvite":
                additions += '''
class TeamInvite(BaseModel):
    """Invite user to team"""
    user_id: int
    role: str = "member"
    message: Optional[str] = None
'''
            elif schema == "TeamMemberList":
                additions += '''
class TeamMemberList(BaseModel):
    """List of team members"""
    members: List[TeamMemberResponse]
    total: int
'''
            else:
                # Generic schema
                additions += f'''
class {schema}(BaseModel):
    """Auto-generated schema for {schema}"""
    # TODO: Add proper fields
    data: Optional[dict] = None
'''
        
        # Check if we need to add imports
        if "List" in additions and "from typing import" in schema_content:
            # Update typing imports if needed
            lines = open("schemas/team_schemas.py").readlines()
            for i, line in enumerate(lines):
                if line.startswith("from typing import"):
                    if "List" not in line:
                        lines[i] = line.strip()[:-1] + ", List\n"
                        with open("schemas/team_schemas.py", "w") as f:
                            f.writelines(lines)
                        schema_content = ''.join(lines)
                    break
        
        with open("schemas/team_schemas.py", "a") as f:
            f.write(additions)
        
        print(f"✅ Added {len(missing)} missing schemas")
    else:
        print("✅ All schemas already exist")
