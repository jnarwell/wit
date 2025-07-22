#!/usr/bin/env python3
"""Create missing router files"""

import os

# Check which router files exist
existing_routers = [f[:-3] for f in os.listdir('routers') if f.endswith('.py') and f != '__init__.py']
print(f"Existing routers: {existing_routers}")

# Expected routers from dev_server.py
expected_routers = [
    'auth_router',
    'voice_router', 
    'vision_router',
    'equipment_router',
    'workspace_router',
    'system_router',
    'network_router'
]

# Create missing router files
for router_name in expected_routers:
    filename = f"routers/{router_name}.py"
    if not os.path.exists(filename):
        print(f"Creating {filename}...")
        
        router_content = f'''"""
{router_name.replace('_', ' ').title()} Router
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/{router_name.replace('_router', '')}",
    tags=["{router_name.replace('_router', '')}"]
)

@router.get("/")
async def get_{router_name.replace('_router', '')}():
    """Get {router_name.replace('_router', '')} information"""
    return {{
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "message": "{router_name.replace('_router', '').title()} API"
    }}

@router.get("/status")
async def get_{router_name.replace('_router', '')}_status():
    """Get {router_name.replace('_router', '')} status"""
    return {{
        "status": "online",
        "version": "1.0.0"
    }}
'''
        
        with open(filename, 'w') as f:
            f.write(router_content)
        print(f"✅ Created {filename}")

# Update routers/__init__.py to export all routers
print("\nUpdating routers/__init__.py...")

init_content = '''"""W.I.T. API Routers"""

# Import existing routers
from .projects import router as projects_router
from .tasks import router as tasks_router
from .teams import router as teams_router
from .materials import router as materials_router
from .files import router as files_router

# Import system routers
from .auth_router import router as auth_router
from .voice_router import router as voice_router
from .vision_router import router as vision_router
from .equipment_router import router as equipment_router
from .workspace_router import router as workspace_router
from .system_router import router as system_router
from .network_router import router as network_router

__all__ = [
    "projects_router",
    "tasks_router", 
    "teams_router",
    "materials_router",
    "files_router",
    "auth_router",
    "voice_router",
    "vision_router",
    "equipment_router",
    "workspace_router",
    "system_router",
    "network_router",
]
'''

with open('routers/__init__.py', 'w') as f:
    f.write(init_content)

print("✅ Updated routers/__init__.py")
