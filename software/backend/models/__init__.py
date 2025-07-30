# software/backend/models/__init__.py
"""Import all models to ensure they're registered with SQLAlchemy"""

# Import base first
import sys
from pathlib import Path

# Add backend directory to Python path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.database_services import Base

# Import all models
# from .microcontroller import Microcontroller, SensorReading, DeviceLog  # Commented to fix duplicate model issue

__all__ = [
    'Base',
    # 'Microcontroller',
    # 'SensorReading', 
    # 'DeviceLog'
]