"""File schemas for W.I.T."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class FileBase(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: str
    file_size: int = Field(..., gt=0)
    project_id: Optional[int] = None

class FileCreate(FileBase):
    file_path: str

class FileResponse(FileBase):
    id: int
    file_path: str
    uploaded_at: datetime
    uploaded_by: Optional[int] = None
    
    class Config:
        from_attributes = True

class FileVersionResponse(BaseModel):
    """File version response"""
    id: int
    file_id: int
    version_number: int
    file_size: int
    uploaded_by: int
    uploaded_at: datetime
    change_notes: Optional[str] = None
    is_current: bool
    
    class Config:
        from_attributes = True

class FileMoveRequest(BaseModel):
    """Request to move file to different project"""
    target_project_id: int

class FileUpdateRequest(BaseModel):
    """Request to update file metadata"""
    filename: Optional[str] = None
    description: Optional[str] = None

class FileShareRequest(BaseModel):
    """Request to share file"""
    user_ids: Optional[List[int]] = []
    team_ids: Optional[List[int]] = []
    access_level: str = "read"  # 'read', 'write'
    expires_at: Optional[datetime] = None
