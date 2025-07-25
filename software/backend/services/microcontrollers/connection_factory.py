# software/backend/services/microcontrollers/connection_factory.py
from typing import Dict, Any
import logging

from software.backend.models.microcontroller import MicrocontrollerType, ConnectionType
from .base_connection import BaseConnection
from .serial_connection import SerialConnection
from .network_connection import NetworkConnection
from .mqtt_connection import MQTTConnection

logger = logging.getLogger(__name__)


class ConnectionFactory:
    """Factory for creating microcontroller connections"""
    
    async def create_connection(
        self,
        device_type: MicrocontrollerType,
        connection_type: ConnectionType,
        connection_string: str,
        params: Dict[str, Any]
    ) -> BaseConnection:
        """Create a connection based on the connection type"""
        
        # Set default parameters based on device type
        default_params = self._get_default_params(device_type, connection_type)
        final_params = {**default_params, **params}
        
        # Create connection based on type
        if connection_type == ConnectionType.USB_SERIAL:
            return SerialConnection(connection_string, final_params)
            
        elif connection_type in [ConnectionType.NETWORK_TCP, ConnectionType.NETWORK_UDP, ConnectionType.NETWORK_HTTP]:
            return NetworkConnection(connection_string, final_params, connection_type)
            
        elif connection_type == ConnectionType.NETWORK_MQTT:
            return MQTTConnection(connection_string, final_params)
            
        else:
            raise ValueError(f"Unsupported connection type: {connection_type}")
    
    def _get_default_params(self, device_type: MicrocontrollerType, connection_type: ConnectionType) -> Dict[str, Any]:
        """Get default connection parameters based on device type"""
        
        defaults = {}
        
        # Serial connection defaults
        if connection_type == ConnectionType.USB_SERIAL:
            if device_type in [MicrocontrollerType.ARDUINO_UNO, MicrocontrollerType.ARDUINO_MEGA, MicrocontrollerType.ARDUINO_NANO]:
                defaults["baudrate"] = 115200
                defaults["timeout"] = 2.0
                defaults["dtr"] = True  # Reset on connect
                
            elif device_type in [MicrocontrollerType.ESP32, MicrocontrollerType.ESP8266]:
                defaults["baudrate"] = 115200
                defaults["timeout"] = 2.0
                defaults["rts"] = False
                defaults["dtr"] = False
                
            elif device_type == MicrocontrollerType.RASPBERRY_PI_PICO:
                defaults["baudrate"] = 115200
                defaults["timeout"] = 2.0
                
        # Network connection defaults
        elif connection_type in [ConnectionType.NETWORK_TCP, ConnectionType.NETWORK_HTTP]:
            if device_type in [MicrocontrollerType.ESP32, MicrocontrollerType.ESP8266]:
                defaults["port"] = 80
                defaults["timeout"] = 5.0
                
            elif device_type.value.startswith("raspberry_pi"):
                defaults["port"] = 8080
                defaults["timeout"] = 5.0
                
        # MQTT defaults
        elif connection_type == ConnectionType.NETWORK_MQTT:
            defaults["port"] = 1883
            defaults["keepalive"] = 60
            defaults["qos"] = 1
            
        return defaults