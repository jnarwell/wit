"""
Auth Service
This is the correct file name (auth_service.py not auth_services.py)
"""
from .auth_services import (
    AuthService, auth_service, get_current_user, 
    get_api_key_user, is_admin, auth_router
)

# Re-export for compatibility
__all__ = [
    'AuthService', 'auth_service', 'get_current_user',
    'get_api_key_user', 'is_admin', 'auth_router'
]
