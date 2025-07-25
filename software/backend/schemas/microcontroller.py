# software/backend/schemas/microcontroller.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class MicrocontrollerType(str, Enum):
    ARDUINO_UNO = "arduino_uno"
    ARDUINO_MEGA = "arduino_mega"
    ARDUINO_NANO = "arduino_nano"
    ESP32 = "esp32"
    ESP8266 = "esp8266"
    RASPBERRY_PI_3 = "raspberry_pi_3"
    RASPBERRY_PI_4 = "raspberry_pi_4"
    RASPBERRY_PI_ZERO = "raspberry_pi_zero"
    RASPBERRY_PI_PICO = "raspberry_pi_pico"
    CUSTOM = "custom"


class ConnectionType(str, Enum):
    USB_SERIAL = "usb_serial"
    NETWORK_TCP = "network_tcp"
    NETWORK_UDP = "network_udp"
    NETWORK_MQTT = "network_mqtt"
    NETWORK_HTTP = "network_http"
    BLUETOOTH = "bluetooth"
    BLUETOOTH_LE = "bluetooth_le"


class ConnectionStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    ERROR = "error"
    UNKNOWN = "unknown"


class MicrocontrollerBase(BaseModel):
    name: str
    type: MicrocontrollerType
    description: Optional[str] = None
    connection_type: ConnectionType
    connection_string: str
    connection_params: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None


class MicrocontrollerCreate(MicrocontrollerBase):
    pass


class MicrocontrollerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    connection_string: Optional[str] = None
    connection_params: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None


class MicrocontrollerResponse(MicrocontrollerBase):
    id: str
    status: ConnectionStatus
    last_seen: Optional[datetime] = None
    firmware_version: Optional[str] = None
    hardware_info: Optional[Dict[str, Any]] = None
    owner_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class MicrocontrollerCommand(BaseModel):
    command: str
    params: Optional[Dict[str, Any]] = None


class MicrocontrollerCommandResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class SensorReadingCreate(BaseModel):
    sensor_type: str
    sensor_id: Optional[str] = None
    value: Any
    unit: Optional[str] = None


class SensorReadingResponse(SensorReadingCreate):
    id: str
    microcontroller_id: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DeviceLogCreate(BaseModel):
    level: str
    message: str
    data: Optional[Dict[str, Any]] = None


class DeviceLogResponse(DeviceLogCreate):
    id: str
    microcontroller_id: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SerialPortInfo(BaseModel):
    port: str
    description: str
    hardware_id: Optional[str] = None
    manufacturer: Optional[str] = None
    product: Optional[str] = None
    serial_number: Optional[str] = None