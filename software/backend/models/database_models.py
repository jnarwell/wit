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




class Task(Base):
    """Task model for project tasks"""
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="medium")
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships (add these to Project and User models too)
    # project = relationship("Project", back_populates="tasks")
    # assigned_user = relationship("User", back_populates="tasks")

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

class Team(Base):
    """Team model"""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    """Team member association model"""
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(50), default="member")
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", backref="team_memberships")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('team_id', 'user_id', name='_team_user_uc'),
    )

class ProjectMaterial(Base):
    """Association between projects and materials"""
    __tablename__ = "project_materials"
    
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity_allocated = Column(Float, default=0.0)
    quantity_used = Column(Float, default=0.0)
    allocated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", backref="material_allocations")
    material = relationship("Material", back_populates="projects")
    
    __table_args__ = (
        UniqueConstraint('project_id', 'material_id', name='_project_material_uc'),
    )


class MaterialUsage(Base):
    """Track material usage history"""
    __tablename__ = "material_usage"
    
    id = Column(Integer, primary_key=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    action = Column(String(20), nullable=False)  # 'add', 'remove', 'adjust'
    reason = Column(String(200), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    material = relationship("Material", back_populates="usage_history")
    project = relationship("Project", backref="material_usage")
    user = relationship("User", backref="material_actions")

# File management models
class ProjectFile(Base):
    """Project file model"""
    __tablename__ = "project_files"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    file_metadata = Column(JSONB, default={})
    
    # Relationships
    project = relationship("Project", backref="files")
    uploader = relationship("User", backref="uploaded_files")
    versions = relationship("FileVersion", back_populates="file", cascade="all, delete-orphan")


class FileVersion(Base):
    """File version history"""
    __tablename__ = "file_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("project_files.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    checksum = Column(String(64), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    change_notes = Column(Text, nullable=True)
    is_current = Column(Boolean, default=True)
    
    # Relationships
    file = relationship("ProjectFile", back_populates="versions")
    uploader = relationship("User", backref="file_versions")
    
    __table_args__ = (
        UniqueConstraint('file_id', 'version_number', name='_file_version_uc'),
    )
