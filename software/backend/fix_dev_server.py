#!/usr/bin/env python3
"""
Fix dev_server.py by adding missing routers from main.py
Run this script to update your dev_server.py with all the project routers
"""

import os
import re

def fix_dev_server():
    """Add missing routers to dev_server.py"""
    
    print("🔧 Fixing dev_server.py - Adding missing routers...")
    
    # Check if dev_server.py exists
    if not os.path.exists("dev_server.py"):
        print("❌ dev_server.py not found!")
        return False
    
    # Read current dev_server.py
    with open("dev_server.py", "r") as f:
        content = f.read()
    
    # Find where to insert router imports (after other imports but before app creation)
    import_insert_pattern = r'(from fastapi import.*?\n(?:from.*?\n)*)'
    import_match = re.search(import_insert_pattern, content, re.DOTALL)
    
    if not import_match:
        print("❌ Could not find import section")
        return False
    
    # Router imports to add
    router_imports = """
# Import routers from main.py
from routers import (
    projects, tasks, teams, materials, files,
    auth_router, voice_router, vision_router, 
    equipment_router, workspace_router, system_router,
    network_router
)
"""
    
    # Check if routers are already imported
    if "from routers import" in content:
        print("✅ Router imports already exist")
    else:
        # Insert router imports after existing imports
        insert_pos = import_match.end()
        content = content[:insert_pos] + router_imports + content[insert_pos:]
        print("✅ Added router imports")
    
    # Find where to add router includes (after app creation)
    app_pattern = r'(app = FastAPI\([^)]*\))'
    app_match = re.search(app_pattern, content)
    
    if not app_match:
        print("❌ Could not find FastAPI app creation")
        return False
    
    # Router includes to add
    router_includes = """

# Include all routers from main.py
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(teams.router, prefix="/api/v1/teams", tags=["teams"])
app.include_router(materials.router, prefix="/api/v1/materials", tags=["materials"])
app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(auth_router)
app.include_router(voice_router)
app.include_router(vision_router)
app.include_router(equipment_router)
app.include_router(workspace_router)
app.include_router(system_router)
app.include_router(network_router)
"""
    
    # Check if routers are already included
    if "app.include_router" in content:
        print("⚠️  Some routers may already be included")
        # Check which ones are missing
        missing_routers = []
        routers_to_check = [
            ("projects.router", "projects"),
            ("tasks.router", "tasks"),
            ("teams.router", "teams"),
            ("materials.router", "materials"),
            ("files.router", "files"),
            ("auth_router", "auth"),
            ("voice_router", "voice"),
            ("vision_router", "vision"),
            ("equipment_router", "equipment"),
            ("workspace_router", "workspace"),
            ("system_router", "system"),
            ("network_router", "network")
        ]
        
        for router_name, tag in routers_to_check:
            if router_name not in content:
                missing_routers.append((router_name, tag))
        
        if missing_routers:
            print(f"📝 Adding {len(missing_routers)} missing routers:")
            # Find last include_router
            last_include = content.rfind("app.include_router")
            if last_include != -1:
                # Find end of line
                line_end = content.find("\n", last_include)
                if line_end != -1:
                    # Add missing routers
                    missing_includes = "\n"
                    for router_name, tag in missing_routers:
                        print(f"   - {router_name}")
                        if "." in router_name:
                            missing_includes += f'app.include_router({router_name}, prefix="/api/v1/{tag}", tags=["{tag}"])\n'
                        else:
                            missing_includes += f'app.include_router({router_name})\n'
                    
                    content = content[:line_end+1] + missing_includes + content[line_end+1:]
    else:
        # No routers included yet, add them all after app creation
        # Find a good insertion point (after CORS middleware if exists)
        cors_pattern = r'app\.add_middleware\(\s*CORSMiddleware[^)]*\)'
        cors_match = re.search(cors_pattern, content, re.DOTALL)
        
        if cors_match:
            insert_pos = cors_match.end()
        else:
            insert_pos = app_match.end()
        
        content = content[:insert_pos] + router_includes + content[insert_pos:]
        print("✅ Added all router includes")
    
    # Create backup
    backup_name = "dev_server.py.backup"
    with open(backup_name, "w") as f:
        f.write(content)
    print(f"📁 Created backup: {backup_name}")
    
    # Write fixed content
    with open("dev_server.py", "w") as f:
        f.write(content)
    
    print("\n✅ Successfully updated dev_server.py!")
    print("\n📋 Added routers:")
    print("   - Projects API (/api/v1/projects)")
    print("   - Tasks API (/api/v1/tasks)")
    print("   - Teams API (/api/v1/teams)")
    print("   - Materials API (/api/v1/materials)")
    print("   - Files API (/api/v1/files)")
    print("   - Auth API")
    print("   - Voice API")
    print("   - Vision API")
    print("   - Equipment API")
    print("   - Workspace API")
    print("   - System API")
    print("   - Network API")
    
    print("\n🚀 Next steps:")
    print("   1. Restart your server: python3 dev_server.py")
    print("   2. Check API docs: http://localhost:8000/docs")
    print("   3. Test the new endpoints")
    
    return True

def create_routers_init():
    """Create routers/__init__.py if missing"""
    if not os.path.exists("routers"):
        print("\n📁 Creating routers directory...")
        os.makedirs("routers")
    
    init_file = "routers/__init__.py"
    if not os.path.exists(init_file):
        print("📝 Creating routers/__init__.py...")
        with open(init_file, "w") as f:
            f.write('"""W.I.T. API Routers"""\n')
        print("✅ Created routers/__init__.py")

if __name__ == "__main__":
    # First ensure routers directory exists
    create_routers_init()
    
    # Then fix dev_server.py
    success = fix_dev_server()
    
    if not success:
        print("\n❌ Failed to update dev_server.py")
        print("   Please check the file manually")
    else:
        print("\n✨ All done! Your dev_server.py should now have all the routers.")