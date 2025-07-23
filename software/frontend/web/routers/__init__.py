"""W.I.T. API Routers"""

# Import system routers
from .auth_router import router as auth_router
from .users_router import router as users_router
from .projects_router import router as projects_router
from .tasks_router import router as tasks_router

__all__ = [
    "auth_router",
    "users_router",
    "projects_router",
    "tasks_router",
]
