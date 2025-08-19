# software/backend/core/sensor_types.py
"""
W.I.T. Sensor Type Definitions
Central configuration for all supported sensor types
"""
from enum import Enum
from typing import Dict, List, Any, Optional

class SensorCategory(str, Enum):
    """Main categories of sensors"""
    # Add sensor categories here
    pass

class SensorType(str, Enum):
    """Specific sensor types"""
    # Add specific sensor types here
    pass

class SensorUnit(str, Enum):
    """Standard units for sensor measurements"""
    # Add units here
    pass

# Sensor type configurations
SENSOR_CONFIGS: Dict[str, Dict[str, Any]] = {
    # Add sensor configurations here
    # Example:
    # "temperature": {
    #     "category": SensorCategory.ENVIRONMENTAL,
    #     "name": "Temperature Sensor",
    #     "units": ["celsius", "fahrenheit", "kelvin"],
    #     "default_unit": "celsius",
    #     "value_type": "float",
    #     "range": {"min": -273.15, "max": 1000},
    # }
}