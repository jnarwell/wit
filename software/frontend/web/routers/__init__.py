"""W.I.T. API Routers"""

# Import system routers
from .auth_router import router as auth_router
from .users_router import router as users_router

__all__ = [
    "auth_router",
    "users_router",
]
