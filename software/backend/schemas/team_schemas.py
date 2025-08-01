# software/backend/schemas/team_schemas.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid

class TeamRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

class TeamMemberAdd(BaseModel):
    """Model for adding a team member"""
    username: str = Field(..., min_length=1, max_length=50)
    role: TeamRole = Field(default=TeamRole.VIEWER)

class TeamMemberUpdate(BaseModel):
    """Model for updating team member role"""
    role: TeamRole

class TeamMemberResponse(BaseModel):
    """Team member response model"""
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    user: Optional[dict] = None  # Will contain user info
    
    class Config:
        from_attributes = True