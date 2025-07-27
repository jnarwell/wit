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
    due_date: datetime | None = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None

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

class TaskListResponse(TaskResponse):
    project_name: str
    title: str  # Alias for name to match frontend expectation

    @classmethod
    def from_task_and_project(cls, task, project):
        return cls(
            id=task.id,
            title=task.name,  # Map name to title
            name=task.name,
            description=task.description,
            status=task.status,
            priority=task.priority,
            due_date=task.due_date,
            project_id=task.project_id,
            project_name=project.name,
            created_at=task.created_at,
            updated_at=task.updated_at
        )

router = APIRouter()

@router.get("/tasks/incomplete", response_model=List[TaskListResponse])
async def get_incomplete_tasks(
    db: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """Get all incomplete tasks (not completed or cancelled) sorted by due date."""
    # Get tasks that are not completed or cancelled
    try:
        result = await db.execute(
            select(Task, Project)
            .join(Project, Task.project_id == Project.id)
            .where(Task.status.notin_(["complete", "cancelled"]))
            .where(Task.due_date.isnot(None))  # Only tasks with due dates
            .where(Task.project_id.isnot(None))  # Only tasks with projects
            .order_by(Task.due_date)
            .offset(skip)
            .limit(limit)
        )
        tasks_with_projects = result.all()
        
        return [
            TaskListResponse.from_task_and_project(task, project)
            for task, project in tasks_with_projects
        ]
    except Exception as e:
        # Log the error for debugging
        import logging
        logging.error(f"Error fetching incomplete tasks: {e}")
        # Return empty list if there's an error
        return []

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
        due_date=task.due_date,
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
