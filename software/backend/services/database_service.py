"""
Database Service
This is the correct file name (database_service.py not database_services.py)
"""
from .database_services import DatabaseService, Base, get_db_session

# Re-export for compatibility
__all__ = ['DatabaseService', 'Base', 'get_db_session']
