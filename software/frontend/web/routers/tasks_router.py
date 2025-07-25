# software/frontend/web/routers/tasks_router.py
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from software.backend.services.database_services import get_session, Task, Project
from pydantic import BaseModel
from datetime import datetime

# --- Pydantic Schemas for Tasks ---
class TaskBase(BaseModel):
    name: str
    description: str | None = None
    status: str = "not_started"  # not_started, in_progress, blocked, complete
    priority: str = "medium"  # low, medium, high

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None

class TaskResponse(TaskBase):
    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

router = APIRouter()

@router.post("/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task_for_project(
    project_id: str,
    task: TaskCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new task for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_task = Task(
        name=task.name,
        description=task.description,
        status=task.status,
        priority=task.priority,
        project_id=project.id
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task

@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def get_tasks_for_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """Get all tasks for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Task)
        .where(Task.project_id == project.id)
        .offset(skip)
        .limit(limit)
    )
    tasks = result.scalars().all()
    return tasks

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Update a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in task_update.dict(exclude_unset=True).items():
        setattr(task, key, value)
    
    # Update the updated_at timestamp
    task.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(task)
    return task

@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def patch_task(
    task_id: uuid.UUID,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Partially update a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Only update fields that were provided
    update_data = task_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    # Update the updated_at timestamp
    task.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
):
    """Delete a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return
