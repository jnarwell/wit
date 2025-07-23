"""
W.I.T. Database Models - SQLite Compatible

File: software/backend/models/database_models_extended.py

Database models that work with both PostgreSQL and SQLite
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, JSON, Text,
    ForeignKey, Index, UniqueConstraint, CheckConstraint, Table
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref
from datetime import datetime
import uuid
import os

Base = declarative_base()

# Helper function to determine if we're using SQLite
def is_sqlite():
    db_url = os.getenv("DATABASE_URL", "sqlite:///data/wit_local.db")
    return "sqlite" in db_url.lower()

# Use String IDs for SQLite, UUID for PostgreSQL
def get_id_column():
    """Get appropriate ID column type based on database"""
    if is_sqlite():
        return Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    else:
        from sqlalchemy.dialects.postgresql import UUID
        return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

def get_fk_column(table_name):
    """Get appropriate foreign key column type"""
    if is_sqlite():
        return Column(String(36), ForeignKey(f'{table_name}.id'))
    else:
        from sqlalchemy.dialects.postgresql import UUID
        return Column(UUID(as_uuid=True), ForeignKey(f'{table_name}.id'))


# Association tables for many-to-many relationships
project_tags = Table(
    'project_tags',
    Base.metadata,
    Column('project_id', get_id_column().type, ForeignKey('projects.id')),
    Column('tag_id', get_id_column().type, ForeignKey('tags.id')),
    UniqueConstraint('project_id', 'tag_id')
)

task_dependencies = Table(
    'task_dependencies',
    Base.metadata,
    Column('task_id', get_id_column().type, ForeignKey('tasks.id')),
    Column('depends_on_id', get_id_column().type, ForeignKey('tasks.id')),
    UniqueConstraint('task_id', 'depends_on_id')
)


class User(Base):
    """User model for authentication and preferences"""
    __tablename__ = "users"
    
    id = get_id_column()
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
    tasks_created = relationship("Task", foreign_keys="Task.created_by", back_populates="creator")
    tasks_assigned = relationship("Task", foreign_keys="Task.assignee_id", back_populates="assignee")
    team_memberships = relationship("TeamMember", back_populates="user")
    files_uploaded = relationship("ProjectFile", back_populates="uploaded_by_user", foreign_keys="[ProjectFile.uploaded_by]")
    material_usage = relationship("MaterialUsage", back_populates="used_by_user")


class Equipment(Base):
    """Equipment and tools in the workspace"""
    __tablename__ = "equipment"
    
    id = get_id_column()
    equipment_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # printer, cnc, laser, etc.
    manufacturer = Column(String(100))
    model = Column(String(100))
    status = Column(String(50), default="offline")
    config = Column(JSON, default=dict)
    location = Column(String(100))
    added_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime)
    extra_data = Column(JSON, default=dict)
    
    # Relationships
    jobs = relationship("Job", back_populates="equipment")
    
    __table_args__ = (
        Index("idx_equipment_type_status", "type", "status"),
    )


class Project(Base):
    """Project model"""
    __tablename__ = "projects"
    
    id = get_id_column()
    project_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    type = Column(String(50))
    status = Column(String(50), default="active")
    owner_id = get_fk_column("users")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Extended fields stored in extra_data
    extra_data = Column(JSON, default=dict)
    # extra_data includes: team, priority, deadline, budget, estimated_hours, tags, custom_fields
    
    # Relationships
    owner = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="project", cascade="all, delete-orphan")
    materials = relationship("ProjectMaterial", back_populates="project", cascade="all, delete-orphan")
    files = relationship("ProjectFile", back_populates="project", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="project")
    tags = relationship("Tag", secondary=project_tags, back_populates="projects")


class Task(Base):
    """Task model for project management"""
    __tablename__ = "tasks"
    
    id = get_id_column()
    task_id = Column(String(50), unique=True, nullable=False, index=True)
    project_id = get_fk_column("projects")
    parent_id = get_fk_column("tasks")
    
    # Core fields
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="todo")  # todo, in_progress, review, done
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    position = Column(Integer, default=0)  # For kanban board ordering
    
    # Assignments and dates
    assignee_id = get_fk_column("users")
    created_by = get_fk_column("users")
    due_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Time tracking
    estimated_hours = Column(Float)
    actual_hours = Column(Float, default=0)
    
    # Additional data
    tags = Column(JSON, default=list)
    extra_data = Column(JSON, default=dict)
    # extra_data includes: checklist, attachments, custom_fields, history
    
    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="tasks_assigned")
    creator = relationship("User", foreign_keys=[created_by], back_populates="tasks_created")
    parent = relationship("Task", remote_side=[id], backref="subtasks")
    dependencies = relationship(
        "Task",
        secondary=task_dependencies,
        primaryjoin=id == task_dependencies.c.task_id,
        secondaryjoin=id == task_dependencies.c.depends_on_id,
        backref="dependent_tasks"
    )
    
    __table_args__ = (
        Index("idx_task_status_position", "status", "position"),
        Index("idx_task_project_status", "project_id", "status"),
    )


class Team(Base):
    """Team/subteam model"""
    __tablename__ = "teams"
    
    id = get_id_column()
    team_id = Column(String(50), unique=True, nullable=False, index=True)
    project_id = get_fk_column("projects")
    name = Column(String(100), nullable=False)
    description = Column(Text)
    type = Column(String(50), default="general")  # engineering, design, qa, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional data
    extra_data = Column(JSON, default=dict)
    # extra_data includes: focus_area, tools, schedule, custom_fields
    
    # Relationships
    project = relationship("Project", back_populates="teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    """Team member model"""
    __tablename__ = "team_members"
    
    id = get_id_column()
    team_id = get_fk_column("teams")
    user_id = get_fk_column("users")
    role = Column(String(50), default="member")  # member, lead, admin
    permissions = Column(JSON, default=list)
    joined_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional data
    extra_data = Column(JSON, default=dict)
    # extra_data includes: skills, availability, notes
    
    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")
    
    __table_args__ = (
        UniqueConstraint('team_id', 'user_id'),
        Index("idx_team_member_user", "user_id", "team_id"),
    )


class Material(Base):
    """Material inventory model"""
    __tablename__ = "materials"
    
    id = get_id_column()
    material_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # filament, wood, metal, etc.
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # kg, m, pieces, etc.
    location = Column(String(100))
    color = Column(String(50))
    properties = Column(JSON, default=dict)
    supplier = Column(String(100))
    cost_per_unit = Column(Float)
    min_stock_level = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project_materials = relationship("ProjectMaterial", back_populates="material")


class ProjectMaterial(Base):
    """Project material requirements (BOM)"""
    __tablename__ = "project_materials"
    
    id = get_id_column()
    project_id = get_fk_column("projects")
    material_id = get_fk_column("materials")
    required_quantity = Column(Float, nullable=False)
    allocated_quantity = Column(Float, default=0)
    notes = Column(Text)
    added_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional data
    extra_data = Column(JSON, default=dict)
    # extra_data includes: specifications, alternatives, critical
    
    # Relationships
    project = relationship("Project", back_populates="materials")
    material = relationship("Material", back_populates="project_materials")
    usage_history = relationship("MaterialUsage", back_populates="project_material", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('project_id', 'material_id'),
        Index("idx_project_material", "project_id", "material_id"),
    )


class MaterialUsage(Base):
    """Material usage tracking"""
    __tablename__ = "material_usage"
    
    id = get_id_column()
    project_material_id = get_fk_column("project_materials")
    quantity = Column(Float, nullable=False)  # Negative for returns
    purpose = Column(String(200))
    used_by = get_fk_column("users")
    used_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    location = Column(String(100))
    
    # Additional data
    extra_data = Column(JSON, default=dict)
    # extra_data includes: task_id, equipment_id, waste_percentage
    
    # Relationships
    project_material = relationship("ProjectMaterial", back_populates="usage_history")
    used_by_user = relationship("User", back_populates="material_usage")


class ProjectFile(Base):
    """Project file storage"""
    __tablename__ = "project_files"
    
    id = get_id_column()
    file_id = Column(String(50), unique=True, nullable=False, index=True)
    project_id = get_fk_column("projects")
    name = Column(String(255), nullable=False)
    folder = Column(String(500), default="/")
    file_type = Column(String(50))  # image, video, document, etc.
    mime_type = Column(String(100))
    size = Column(Integer)  # bytes
    storage_path = Column(String(1000))
    description = Column(Text)
    tags = Column(JSON, default=list)
    
    # Upload tracking
    uploaded_by = get_fk_column("users")
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Soft delete
    deleted_at = Column(DateTime)
    deleted_by = get_fk_column("users")
    
    # Additional data
    extra_data = Column(JSON, default=dict)
    
    # Relationships
    project = relationship("Project", back_populates="files")
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by], back_populates="files_uploaded")
    versions = relationship("FileVersion", back_populates="file", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_project_file_folder", "project_id", "folder"),
        Index("idx_project_file_type", "project_id", "file_type"),
    )


class FileVersion(Base):
    """File version history"""
    __tablename__ = "file_versions"
    
    id = get_id_column()
    file_id = get_fk_column("project_files")
    version_number = Column(Integer, nullable=False)
    size = Column(Integer)
    storage_path = Column(String(1000))
    uploaded_by = get_fk_column("users")
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    changes = Column(Text)
    
    # Relationships
    file = relationship("ProjectFile", back_populates="versions")
    
    __table_args__ = (
        UniqueConstraint('file_id', 'version_number'),
        Index("idx_file_version", "file_id", "version_number"),
    )


class Job(Base):
    """Job/Task model"""
    __tablename__ = "jobs"
    
    id = get_id_column()
    job_id = Column(String(50), unique=True, nullable=False, index=True)
    project_id = get_fk_column("projects")
    equipment_id = get_fk_column("equipment")
    type = Column(String(50))  # print, cut, mill, etc.
    status = Column(String(50), default="pending")
    priority = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    progress = Column(Float, default=0.0)
    file_path = Column(String(500))
    parameters = Column(JSON, default=dict)
    result = Column(JSON)
    error = Column(Text)
    
    # Relationships
    project = relationship("Project", back_populates="jobs")
    equipment = relationship("Equipment", back_populates="jobs")
    
    __table_args__ = (
        Index("idx_job_status_priority", "status", "priority"),
        Index("idx_job_equipment_status", "equipment_id", "status"),
    )


class Tag(Base):
    """Tag model for categorization"""
    __tablename__ = "tags"
    
    id = get_id_column()
    name = Column(String(50), unique=True, nullable=False)
    color = Column(String(7))  # Hex color
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    projects = relationship("Project", secondary=project_tags, back_populates="tags")


class Comment(Base):
    """Comment model for tasks and projects"""
    __tablename__ = "comments"
    
    id = get_id_column()
    content = Column(Text, nullable=False)
    author_id = get_fk_column("users")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Polymorphic association
    commentable_type = Column(String(50))  # 'task' or 'project'
    commentable_id = Column(String(36))
    
    # Parent comment for threading
    parent_id = get_fk_column("comments")
    
    # Relationships
    author = relationship("User")
    parent = relationship("Comment", remote_side=[id], backref="replies")
    
    __table_args__ = (
        Index("idx_comment_commentable", "commentable_type", "commentable_id"),
    )


# Create indexes for better performance
Index("idx_task_assignee_status", Task.__table__.c.assignee_id, Task.__table__.c.status)
Index("idx_material_type_supplier", Material.__table__.c.type, Material.__table__.c.supplier)