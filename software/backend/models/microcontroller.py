# software/backend/models/microcontroller.py
from sqlalchemy import Column, String, Text, JSON, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
import uuid

from services.database_services import Base


class MicrocontrollerType(str, enum.Enum):
    # Cleared for new configuration
    CUSTOM = "custom"


class ConnectionType(str, enum.Enum):
    USB_SERIAL = "usb_serial"
    NETWORK_TCP = "network_tcp"
    NETWORK_UDP = "network_udp"
    NETWORK_MQTT = "network_mqtt"
    NETWORK_HTTP = "network_http"
    BLUETOOTH = "bluetooth"
    BLUETOOTH_LE = "bluetooth_le"


class ConnectionStatus(str, enum.Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    ERROR = "error"
    UNKNOWN = "unknown"


class Microcontroller(Base):
    __tablename__ = "microcontrollers"
    __table_args__ = {'extend_existing': True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(SQLEnum(MicrocontrollerType), nullable=False)
    description = Column(Text)
    
    # Connection details
    connection_type = Column(SQLEnum(ConnectionType), nullable=False)
    connection_string = Column(String, nullable=False)  # Port for serial, IP for network
    connection_params = Column(JSON)  # Baud rate, network port, auth tokens, etc.
    
    # Status
    status = Column(SQLEnum(ConnectionStatus), default=ConnectionStatus.DISCONNECTED)
    last_seen = Column(DateTime)
    
    # Device info
    firmware_version = Column(String)
    hardware_info = Column(JSON)  # CPU, memory, pins, capabilities
    
    # Configuration
    config = Column(JSON)  # Pin mappings, sensor configs, etc.
    
    # Relationships
    owner_id = Column(String, ForeignKey('users.id'), nullable=False)
    # owner = relationship("User", back_populates="microcontrollers")  # TODO: Fix this relationship
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Sensor data and logs
    sensor_readings = relationship("SensorReading", back_populates="microcontroller", cascade="all, delete-orphan")
    device_logs = relationship("DeviceLog", back_populates="microcontroller", cascade="all, delete-orphan")


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = {'extend_existing': True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    microcontroller_id = Column(String, ForeignKey('microcontrollers.id'), nullable=False)
    
    sensor_type = Column(String, nullable=False)  # Cleared for new configuration
    sensor_id = Column(String)  # Identifier for multiple sensors of same type
    value = Column(JSON, nullable=False)  # Flexible for different data types
    unit = Column(String)  # celsius, fahrenheit, percent, etc.
    
    timestamp = Column(DateTime, default=func.now())
    
    microcontroller = relationship("Microcontroller", back_populates="sensor_readings")


class DeviceLog(Base):
    __tablename__ = "device_logs"
    __table_args__ = {'extend_existing': True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    microcontroller_id = Column(String, ForeignKey('microcontrollers.id'), nullable=False)
    
    level = Column(String, nullable=False)  # debug, info, warning, error
    message = Column(Text, nullable=False)
    data = Column(JSON)  # Additional structured data
    
    timestamp = Column(DateTime, default=func.now())
    
    microcontroller = relationship("Microcontroller", back_populates="device_logs")