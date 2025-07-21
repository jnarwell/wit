"""Project schemas for W.I.T."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class ProjectStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ARCHIVED = "archived"

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    metadata: Optional[Dict[str, Any]] = {}

class ProjectCreate(ProjectBase):
    """Schema for creating a project"""
    pass

class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    metadata: Optional[Dict[str, Any]] = None

class ProjectResponse(ProjectBase):
    """Schema for project response"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectList(BaseModel):
    """List of projects with pagination"""
    items: List[ProjectResponse]
    total: int
    page: int = 1
    page_size: int = 50

# Additional schemas for router compatibility

class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with additional information"""
    tasks_count: int = 0
    team_members: List[str] = []
    completion_percentage: float = 0.0
    last_activity: Optional[datetime] = None
    tags: List[str] = []
    files_count: int = 0

class ProjectStatsResponse(BaseModel):
    """Auto-generated schema for ProjectStatsResponse"""
    # TODO: Add proper fields
    pass

class ProjectFilterParams(BaseModel):
    """Auto-generated schema for ProjectFilterParams"""
    # TODO: Add proper fields
    pass
