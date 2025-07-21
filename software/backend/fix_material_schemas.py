#!/usr/bin/env python3
"""Add all missing material schemas"""

import re

# Read the router to find all imports
with open("routers/materials.py", "r") as f:
    content = f.read()

# Extract imports
match = re.search(r'from schemas\.material_schemas import \((.*?)\)', content, re.DOTALL)
if match:
    imports = match.group(1).replace('\n', ' ').replace(',', ' ').split()
    imports = [i.strip() for i in imports if i.strip()]
    print(f"Found imports: {imports}")
    
    # Read current schemas
    with open("schemas/material_schemas.py", "r") as f:
        schema_content = f.read()
    
    # Find missing ones
    missing = []
    for imp in imports:
        if f"class {imp}" not in schema_content:
            missing.append(imp)
    
    if missing:
        print(f"Missing schemas: {missing}")
        
        # Add them
        additions = "\n# Additional schemas for materials router\n"
        
        for schema in missing:
            if schema == "ProjectMaterialAdd":
                additions += '''
class ProjectMaterialAdd(BaseModel):
    """Add material to project"""
    material_id: int
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = None
'''
            elif schema == "MaterialUsageRecord":
                additions += '''
class MaterialUsageRecord(BaseModel):
    """Record material usage"""
    project_id: Optional[int] = None
    quantity: float = Field(..., gt=0)
    action: str = Field(..., pattern="^(add|remove|adjust)$")
    reason: Optional[str] = None
'''
            elif schema == "MaterialStockUpdate":
                additions += '''
class MaterialStockUpdate(BaseModel):
    """Update material stock"""
    quantity: float
    operation: str = Field(..., pattern="^(set|add|subtract)$")
    reason: Optional[str] = None
'''
            elif schema == "MaterialFilter":
                additions += '''
class MaterialFilter(BaseModel):
    """Filter materials"""
    type: Optional[MaterialType] = None
    location: Optional[str] = None
    low_stock: Optional[bool] = None
    search: Optional[str] = None
'''
            elif schema == "MaterialStats":
                additions += '''
class MaterialStats(BaseModel):
    """Material statistics"""
    total_types: int = 0
    total_value: float = 0.0
    low_stock_items: int = 0
    by_type: Dict[str, int] = {}
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
        if ("Dict" in additions or "Field" in additions) and "from pydantic import" in schema_content:
            lines = open("schemas/material_schemas.py").readlines()
            for i, line in enumerate(lines):
                if line.startswith("from pydantic import"):
                    current_imports = line.strip().replace("from pydantic import ", "").split(", ")
                    if "Field" not in current_imports:
                        current_imports.append("Field")
                    lines[i] = f"from pydantic import {', '.join(current_imports)}\n"
                    with open("schemas/material_schemas.py", "w") as f:
                        f.writelines(lines)
                    break
        
        with open("schemas/material_schemas.py", "a") as f:
            f.write(additions)
        
        print(f"✅ Added {len(missing)} missing schemas")
    else:
        print("✅ All schemas already exist")
