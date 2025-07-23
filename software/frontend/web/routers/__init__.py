"""W.I.T. API Routers"""

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
