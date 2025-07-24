"""W.I.T. API Routers"""

# Import system routers
from .auth_router import router as auth_router
from .users_router import router as users_router
from .projects_router import router as projects_router
from .tasks_router import router as tasks_router
from .equipment_router import router as equipment_router
from .files_router import router as files_router
from .members_router import router as members_router

__all__ = [
    "auth_router",
    "users_router",
    "projects_router",
    "tasks_router",
    "equipment_router",
    "files_router",
    "members_router",
]
