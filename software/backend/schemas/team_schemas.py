"""Team schemas for W.I.T."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TeamBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class TeamCreate(TeamBase):
    member_ids: Optional[List[int]] = []

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class TeamResponse(TeamBase):
    id: int
    created_at: datetime
    member_count: int = 0
    
    class Config:
        from_attributes = True

class TeamMemberAdd(BaseModel):
    user_id: int
    role: Optional[str] = "member"

class TeamMemberResponse(BaseModel):
    user_id: int
    username: str
    role: str
    joined_at: datetime

class TeamMemberUpdate(BaseModel):
    """Update team member role"""
    role: str = Field(..., min_length=1, max_length=50)

# Additional schemas for teams router

class TeamInviteRequest(BaseModel):
    """Auto-generated schema for TeamInviteRequest"""
    # TODO: Add proper fields
    data: Optional[dict] = None

class TeamRoleUpdate(BaseModel):
    """Auto-generated schema for TeamRoleUpdate"""
    # TODO: Add proper fields
    data: Optional[dict] = None
