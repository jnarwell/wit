"""
W.I.T. Database Models

Complete model definitions for all WIT data
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, JSON, Text,
    ForeignKey, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

# Helper to use JSON or JSONB based on database
def JSONField():
    """Return JSON or JSONB field based on database type"""
    # This will be handled by the database service
    return JSON


class User(Base):
    """User model for authentication and preferences"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    # User preferences and settings
    preferences = Column(JSON, default=dict)
    voice_settings = Column(JSON, default=dict)
    workspace_config = Column(JSON, default=dict)
    
    # Relationships
    projects = relationship("Project", back_populates="owner")
    commands = relationship("CommandHistory", back_populates="user")


class Workspace(Base):
    """Physical workspace configuration"""
    __tablename__ = "workspaces"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    layout = Column(JSON, default=dict)  # 3D workspace layout
    cameras = Column(JSON, default=list)  # Camera positions
    zones = Column(JSON, default=list)    # Safety/work zones
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    equipment = relationship("Equipment", back_populates="workspace")


class Equipment(Base):
    """Equipment and tools in the workspace"""
    __tablename__ = "equipment"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # printer, cnc, laser, etc.
    manufacturer = Column(String(100))
    model = Column(String(100))
    serial_number = Column(String(100))
    
    # Status and configuration
    status = Column(String(50), default="offline")
    is_online = Column(Boolean, default=False)
    config = Column(JSON, default=dict)
    capabilities = Column(JSON, default=dict)
    
    # Connection details
    connection_type = Column(String(50))  # serial, network, api
    connection_params = Column(JSON, default=dict)
    
    # Location
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"))
    position = Column(JSON)  # 3D position in workspace
    
    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime)
    last_maintenance = Column(DateTime)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="equipment")
    jobs = relationship("Job", back_populates="equipment")
    telemetry = relationship("Telemetry", back_populates="equipment")
    
    __table_args__ = (
        Index("idx_equipment_type_status", "type", "status"),
    )


class Project(Base):
    """User projects and designs"""
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    type = Column(String(50))  # 3d_print, cnc, laser_cut, etc.
    status = Column(String(50), default="active")
    
    # Files and data
    files = Column(JSON, default=list)  # List of file references
    preview_image = Column(String(500))
    settings = Column(JSON, default=dict)
    
    # Ownership
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_public = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Relationships
    owner = relationship("User", back_populates="projects")
    jobs = relationship("Job", back_populates="project")


class Job(Base):
    """Manufacturing jobs/tasks"""
    __tablename__ = "jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(50), unique=True, nullable=False, index=True)
    type = Column(String(50), nullable=False)  # print, cut, mill, etc.
    status = Column(String(50), default="pending")
    priority = Column(Integer, default=5)
    
    # References
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipment.id"))
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"))
    
    # Job details
    file_path = Column(String(500))
    parameters = Column(JSON, default=dict)
    estimated_duration = Column(Integer)  # seconds
    estimated_material = Column(Float)
    
    # Progress tracking
    progress = Column(Float, default=0.0)
    current_layer = Column(Integer)
    total_layers = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    scheduled_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    
    # Results
    result = Column(JSON)
    error = Column(Text)
    
    # Relationships
    project = relationship("Project", back_populates="jobs")
    equipment = relationship("Equipment", back_populates="jobs")
    material = relationship("Material", back_populates="jobs")
    
    __table_args__ = (
        Index("idx_job_status_priority", "status", "priority"),
        Index("idx_job_equipment_status", "equipment_id", "status"),
    )


class Material(Base):
    """Material inventory tracking"""
    __tablename__ = "materials"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # filament, wood, metal, etc.
    subtype = Column(String(50))  # PLA, ABS, pine, aluminum, etc.
    
    # Inventory
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # kg, m, sheets, etc.
    location = Column(String(100))
    min_stock_level = Column(Float)
    
    # Properties
    color = Column(String(50))
    properties = Column(JSON, default=dict)  # density, melting point, etc.
    
    # Cost tracking
    supplier = Column(String(100))
    cost_per_unit = Column(Float)
    currency = Column(String(3), default="USD")
    
    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime)
    
    # Relationships
    jobs = relationship("Job", back_populates="material")


class CommandHistory(Base):
    """Voice command history and analytics"""
    __tablename__ = "command_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    command = Column(String(500), nullable=False)
    interpreted_intent = Column(String(100))
    confidence = Column(Float)
    
    # Execution details
    target_type = Column(String(50))  # equipment, project, system, etc.
    target_id = Column(String(100))
    parameters = Column(JSON, default=dict)
    
    # User and context
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    source = Column(String(50))  # voice, api, web, etc.
    context = Column(JSON, default=dict)
    
    # Results
    success = Column(Boolean)
    result = Column(JSON)
    error = Column(Text)
    execution_time_ms = Column(Integer)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="commands")
    
    __table_args__ = (
        Index("idx_command_user_timestamp", "user_id", "timestamp"),
        Index("idx_command_intent_timestamp", "interpreted_intent", "timestamp"),
    )


class Telemetry(Base):
    """Time-series telemetry data"""
    __tablename__ = "telemetry"
    
    # Composite primary key for time-series
    time = Column(DateTime, primary_key=True, default=datetime.utcnow)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipment.id"), primary_key=True)
    metric = Column(String(100), primary_key=True)
    
    # Data
    value = Column(Float, nullable=False)
    unit = Column(String(20))
    tags = Column(JSON, default=dict)
    
    # Relationships
    equipment = relationship("Equipment", back_populates="telemetry")
    
    __table_args__ = (
        Index("idx_telemetry_equipment_time", "equipment_id", "time"),
        Index("idx_telemetry_metric_time", "metric", "time"),
    )


class SafetyEvent(Base):
    """Safety monitoring and alerts"""
    __tablename__ = "safety_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)  # info, warning, critical, emergency
    
    # Event details
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(JSON)  # 3D coordinates or zone
    
    # Detection
    detected_by = Column(String(50))  # camera, sensor, manual, etc.
    detection_data = Column(JSON, default=dict)
    confidence = Column(Float)
    
    # Response
    auto_response = Column(JSON)  # Automatic actions taken
    requires_action = Column(Boolean, default=False)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    acknowledged_at = Column(DateTime)
    
    # Resolution
    resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)
    
    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index("idx_safety_severity_timestamp", "severity", "timestamp"),
        Index("idx_safety_resolved_timestamp", "resolved", "timestamp"),
    )
