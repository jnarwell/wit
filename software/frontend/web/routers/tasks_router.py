# software/frontend/web/routers/tasks_router.py
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from software.backend.services.database_services import get_session, Task, Project
from pydantic import BaseModel

# --- Pydantic Schemas for Tasks ---
class TaskBase(BaseModel):
    name: str
    description: str | None = None

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: uuid.UUID
    status: str
    project_id: uuid.UUID

    class Config:
        orm_mode = True

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
