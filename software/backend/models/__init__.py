# software/backend/models/__init__.py
"""Import all models to ensure they're registered with SQLAlchemy"""

# Import base first
from software.backend.services.database_services import Base

# Import all models
from .microcontroller import Microcontroller, SensorReading, DeviceLog

__all__ = [
    'Base',
    'Microcontroller',
    'SensorReading', 
    'DeviceLog'
]