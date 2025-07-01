"""
W.I.T. Database Models

SQLAlchemy models for the W.I.T. Terminal system.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()


class EquipmentType(str, enum.Enum):
    """Types of workshop equipment"""
    PRINTER_3D = "3d_printer"
    CNC_ROUTER = "cnc_router"
    CNC_MILL = "cnc_mill"
    LASER_CUTTER = "laser_cutter"
    VINYL_CUTTER = "vinyl_cutter"
    RESIN_PRINTER = "resin_printer"
    OTHER = "other"


class JobStatus(str, enum.Enum):
    """Job status states"""
    QUEUED = "queued"
    PREPARING = "preparing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AlertSeverity(str, enum.Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100))
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Preferences
    preferences = Column(JSON, default={})
    voice_profile = Column(JSON, default={})
    
    # Relationships
    jobs = relationship("Job", back_populates="user")
    commands = relationship("VoiceCommand", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.username}>"


class Equipment(Base):
    """Workshop equipment model"""
    __tablename__ = "equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    type = Column(Enum(EquipmentType), nullable=False)
    model = Column(String(100))
    serial_number = Column(String(100))
    
    # Connection details
    connection_type = Column(String(50))  # octoprint, grbl, linuxcnc, etc.
    connection_url = Column(String(255))
    api_key = Column(String(255))
    
    # Status
    is_online = Column(Boolean, default=False)
    is_operational = Column(Boolean, default=True)
    last_seen = Column(DateTime(timezone=True))
    
    # Configuration
    config = Column(JSON, default={})
    capabilities = Column(JSON, default={})
    
    # Maintenance
    total_usage_hours = Column(Float, default=0.0)
    last_maintenance = Column(DateTime(timezone=True))
    maintenance_interval_hours = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    jobs = relationship("Job", back_populates="equipment")
    telemetry = relationship("EquipmentTelemetry", back_populates="equipment")
    
    def __repr__(self):
        return f"<Equipment {self.name} ({self.type})>"


class Job(Base):
    """Manufacturing job model"""
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    
    # User and equipment
    user_id = Column(Integer, ForeignKey("users.id"))
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    
    # Job details
    file_path = Column(String(500))
    gcode_path = Column(String(500))
    settings = Column(JSON, default={})
    material = Column(String(100))
    
    # Progress tracking
    progress = Column(Float, default=0.0)
    estimated_duration = Column(Integer)  # seconds
    actual_duration = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Results
    success = Column(Boolean)
    error_message = Column(Text)
    output_files = Column(JSON, default=[])
    
    # Relationships
    user = relationship("User", back_populates="jobs")
    equipment = relationship("Equipment", back_populates="jobs")
    
    def __repr__(self):
        return f"<Job {self.name} ({self.status})>"


class VoiceCommand(Base):
    """Voice command history"""
    __tablename__ = "voice_commands"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Command details
    text = Column(Text, nullable=False)
    intent = Column(String(50))
    entities = Column(JSON, default={})
    confidence = Column(Float)
    
    # Audio details
    audio_duration = Column(Float)
    audio_path = Column(String(500))
    
    # Processing
    processing_time_ms = Column(Float)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    # Response
    response_text = Column(Text)
    action_taken = Column(JSON)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="commands")
    
    def __repr__(self):
        return f"<VoiceCommand '{self.text[:50]}...'>"


class EquipmentTelemetry(Base):
    """Equipment telemetry data"""
    __tablename__ = "equipment_telemetry"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    
    # Telemetry data
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    temperatures = Column(JSON)  # {"hotend": 200, "bed": 60, "chamber": 25}
    positions = Column(JSON)     # {"x": 100, "y": 50, "z": 10}
    speeds = Column(JSON)        # {"feed_rate": 100, "spindle_rpm": 10000}
    power = Column(JSON)         # {"voltage": 24, "current": 2.5, "watts": 60}
    
    # Status
    state = Column(String(50))
    errors = Column(JSON, default=[])
    warnings = Column(JSON, default=[])
    
    # Raw data for debugging
    raw_data = Column(JSON)
    
    # Relationships
    equipment = relationship("Equipment", back_populates="telemetry")
    
    def __repr__(self):
        return f"<EquipmentTelemetry {self.equipment_id} @ {self.timestamp}>"


class SafetyEvent(Base):
    """Safety system events"""
    __tablename__ = "safety_events"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Event details
    event_type = Column(String(50), nullable=False)  # emergency_stop, interlock, etc.
    severity = Column(Enum(AlertSeverity), nullable=False)
    source = Column(String(100))  # voice, button, sensor, etc.
    
    # Description
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Actions taken
    actions = Column(JSON, default=[])
    equipment_affected = Column(JSON, default=[])
    
    # Resolution
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(100))
    resolution_notes = Column(Text)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<SafetyEvent {self.event_type} ({self.severity})>"


class Material(Base):
    """Material inventory"""
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50))  # filament, sheet, block, resin
    
    # Properties
    properties = Column(JSON, default={})  # density, melting_point, etc.
    compatible_equipment = Column(JSON, default=[])
    
    # Inventory
    quantity = Column(Float, default=0.0)
    unit = Column(String(20))  # kg, m, sheets, bottles
    location = Column(String(100))
    
    # Purchasing
    supplier = Column(String(100))
    cost_per_unit = Column(Float)
    reorder_point = Column(Float)
    
    # Usage tracking
    total_used = Column(Float, default=0.0)
    last_used = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Material {self.name} ({self.quantity} {self.unit})>"


class WorkshopSession(Base):
    """Workshop usage sessions"""
    __tablename__ = "workshop_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Session details
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    
    # Activities
    equipment_used = Column(JSON, default=[])
    jobs_completed = Column(JSON, default=[])
    materials_consumed = Column(JSON, default={})
    
    # Voice interaction
    voice_commands_count = Column(Integer, default=0)
    voice_success_rate = Column(Float)
    
    # Safety
    safety_incidents = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<WorkshopSession user={self.user_id} @ {self.start_time}>"


class SystemMetric(Base):
    """System performance metrics"""
    __tablename__ = "system_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Performance metrics
    cpu_usage = Column(Float)
    memory_usage = Column(Float)
    disk_usage = Column(Float)
    gpu_usage = Column(Float)
    npu_usage = Column(Float)
    
    # Service metrics
    voice_latency_ms = Column(Float)
    vision_fps = Column(Float)
    mqtt_messages_per_sec = Column(Float)
    
    # Network
    network_latency_ms = Column(Float)
    bandwidth_mbps = Column(Float)
    
    # Temperature
    temperatures = Column(JSON)  # {"cpu": 45, "gpu": 50, "npu": 40}
    
    def __repr__(self):
        return f"<SystemMetric @ {self.timestamp}>"


# Create indexes for time-series queries
from sqlalchemy import Index

Index('idx_telemetry_equipment_time', EquipmentTelemetry.equipment_id, EquipmentTelemetry.timestamp)
Index('idx_metrics_time', SystemMetric.timestamp)
Index('idx_voice_commands_user_time', VoiceCommand.user_id, VoiceCommand.created_at)