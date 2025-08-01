"""Project schemas for W.I.T."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class ProjectStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETE = "complete"

class ProjectPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ProjectType(str, Enum):
    SOFTWARE = "software"
    HARDWARE = "hardware"
    RESEARCH = "research"
    DESIGN = "design"
    MANUFACTURING = "manufacturing"
    OTHER = "other"

class ProjectBase(BaseModel):
    """Base project model"""
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    type: ProjectType = Field(default=ProjectType.SOFTWARE)
    status: ProjectStatus = Field(default=ProjectStatus.NOT_STARTED)
    priority: ProjectPriority = Field(default=ProjectPriority.MEDIUM)
    extra_data: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ProjectCreate(ProjectBase):
    """Project creation model"""
    pass

class ProjectUpdate(BaseModel):
    """Project update model - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    type: Optional[ProjectType] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    extra_data: Optional[Dict[str, Any]] = None

class ProjectResponse(ProjectBase):
    """Project response model"""
    id: str
    project_id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    """Project list response with pagination"""
    projects: List[ProjectResponse]
    total: int
    skip: int
    limit: int

class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with team and tasks"""
    team_members: List[Dict[str, Any]] = []  # Will be TeamMemberResponse
    tasks: List[Dict[str, Any]] = []  # Will be TaskResponse
    statistics: Dict[str, Any] = {}

class ProjectStatsResponse(BaseModel):
    """Project statistics response"""
    total_tasks: int = 0
    completed_tasks: int = 0
    completion_rate: float = 0.0
    task_breakdown: Dict[str, int] = {}
    file_count: int = 0
