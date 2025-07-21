"""Task schemas for W.I.T."""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    project_id: Optional[int] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None

class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TaskMoveRequest(BaseModel):
    """Request schema for moving a task between projects or changing order"""
    project_id: Optional[int] = None
    new_position: Optional[int] = None
    new_status: Optional[TaskStatus] = None

class TaskAssignRequest(BaseModel):
    """Request schema for assigning a task to a user"""
    user_id: Optional[int] = None
    notify: bool = True
    notes: Optional[str] = None

# Additional schemas for tasks router

class TaskBulkUpdate(BaseModel):
    """Auto-generated schema for TaskBulkUpdate"""
    # TODO: Add proper fields
    data: Optional[Dict[str, Any]] = None
