"""
W.I.T. Tasks API Router

File: software/backend/routers/tasks.py

Task management endpoints for projects
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update
from uuid import UUID

from ..services.database_services import get_session
from ..models.database_models import Project, User, Task
from ..auth.dependencies import get_current_user
from ..schemas.task_schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskMoveRequest,
    TaskAssignRequest,
    TaskBulkUpdate
)

router = APIRouter(prefix="/api/v1/projects/{project_id}/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskResponse])
async def get_project_tasks(
    project_id: str,
    status: Optional[str] = None,
    assignee_id: Optional[str] = None,
    priority: Optional[str] = None,
    parent_id: Optional[str] = None,
    include_subtasks: bool = True,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all tasks for a project"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Build task query
    query = select(Task).where(Task.project_id == project.id)
    
    # Apply filters
    if status:
        query = query.where(Task.status == status)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)
    if priority:
        query = query.where(Task.priority == priority)
    if parent_id is not None:
        if parent_id == "root":
            query = query.where(Task.parent_id.is_(None))
        else:
            query = query.where(Task.parent_id == parent_id)
    
    # Order by position for kanban boards
    query = query.order_by(Task.position)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return tasks


@router.post("", response_model=TaskResponse)
async def create_task(
    project_id: str,
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new task"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get next position
    position_query = select(func.coalesce(func.max(Task.position), 0)).where(
        and_(
            Task.project_id == project.id,
            Task.status == task_data.status
        )
    )
    position_result = await db.execute(position_query)
    next_position = position_result.scalar() + 1
    
    # Create task
    task = Task(
        task_id=f"TASK-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        project_id=project.id,
        title=task_data.title,
        description=task_data.description,
        status=task_data.status or "todo",
        priority=task_data.priority or "medium",
        assignee_id=task_data.assignee_id,
        parent_id=task_data.parent_id,
        position=next_position,
        due_date=task_data.due_date,
        estimated_hours=task_data.estimated_hours,
        tags=task_data.tags or [],
        dependencies=task_data.dependencies or [],
        extra_data={
            "checklist": task_data.checklist or [],
            "attachments": [],
            "custom_fields": task_data.custom_fields or {}
        },
        created_by=current_user.id
    )
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    project_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get task details"""
    
    query = select(Task).where(
        and_(
            Task.task_id == task_id,
            Task.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: str,
    task_id: str,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update task details"""
    
    query = select(Task).where(
        and_(
            Task.task_id == task_id,
            Task.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update fields
    update_data = task_update.dict(exclude_unset=True)
    
    # Handle special fields
    if "checklist" in update_data:
        task.extra_data["checklist"] = update_data.pop("checklist")
    if "custom_fields" in update_data:
        task.extra_data["custom_fields"] = update_data.pop("custom_fields")
    
    # Update regular fields
    for field, value in update_data.items():
        setattr(task, field, value)
    
    task.updated_at = datetime.utcnow()
    
    # Update completion status
    if task.status == "done" and not task.completed_at:
        task.completed_at = datetime.utcnow()
    elif task.status != "done" and task.completed_at:
        task.completed_at = None
    
    await db.commit()
    await db.refresh(task)
    
    return task


@router.delete("/{task_id}")
async def delete_task(
    project_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a task"""
    
    query = select(Task).where(
        and_(
            Task.task_id == task_id,
            Task.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.delete(task)
    await db.commit()
    
    return {"message": "Task deleted successfully"}


@router.post("/{task_id}/move", response_model=TaskResponse)
async def move_task(
    project_id: str,
    task_id: str,
    move_request: TaskMoveRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Move task to different status/position"""
    
    query = select(Task).where(
        and_(
            Task.task_id == task_id,
            Task.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update status if changed
    if move_request.status and move_request.status != task.status:
        task.status = move_request.status
        
        # Update completion status
        if task.status == "done":
            task.completed_at = datetime.utcnow()
        else:
            task.completed_at = None
    
    # Update position
    if move_request.position is not None:
        # Shift other tasks
        shift_query = update(Task).where(
            and_(
                Task.project_id == task.project_id,
                Task.status == task.status,
                Task.position >= move_request.position,
                Task.id != task.id
            )
        ).values(position=Task.position + 1)
        
        await db.execute(shift_query)
        task.position = move_request.position
    
    task.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(task)
    
    return task


@router.post("/{task_id}/assign", response_model=TaskResponse)
async def assign_task(
    project_id: str,
    task_id: str,
    assign_request: TaskAssignRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Assign task to user"""
    
    query = select(Task).where(
        and_(
            Task.task_id == task_id,
            Task.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify assignee exists
    if assign_request.assignee_id:
        user_query = select(User).where(User.id == assign_request.assignee_id)
        user_result = await db.execute(user_query)
        assignee = user_result.scalar_one_or_none()
        
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")
    
    task.assignee_id = assign_request.assignee_id
    task.updated_at = datetime.utcnow()
    
    # Log assignment in task history
    if "history" not in task.extra_data:
        task.extra_data["history"] = []
    
    task.extra_data["history"].append({
        "action": "assigned",
        "user_id": str(current_user.id),
        "assignee_id": str(assign_request.assignee_id) if assign_request.assignee_id else None,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    await db.commit()
    await db.refresh(task)
    
    return task


@router.post("/{task_id}/subtasks", response_model=TaskResponse)
async def create_subtask(
    project_id: str,
    task_id: str,
    subtask_data: TaskCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a subtask"""
    
    # Verify parent task exists
    parent_query = select(Task).where(
        and_(
            Task.task_id == task_id,
            Task.project.has(project_id=project_id)
        )
    )
    parent_result = await db.execute(parent_query)
    parent_task = parent_result.scalar_one_or_none()
    
    if not parent_task:
        raise HTTPException(status_code=404, detail="Parent task not found")
    
    # Create subtask
    subtask_data.parent_id = parent_task.id
    return await create_task(project_id, subtask_data, db, current_user)


@router.post("/bulk-update")
async def bulk_update_tasks(
    project_id: str,
    bulk_update: TaskBulkUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Bulk update multiple tasks"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get tasks
    task_query = select(Task).where(
        and_(
            Task.task_id.in_(bulk_update.task_ids),
            Task.project_id == project.id
        )
    )
    task_result = await db.execute(task_query)
    tasks = task_result.scalars().all()
    
    if len(tasks) != len(bulk_update.task_ids):
        raise HTTPException(status_code=404, detail="Some tasks not found")
    
    # Apply updates
    update_data = bulk_update.updates.dict(exclude_unset=True)
    
    for task in tasks:
        for field, value in update_data.items():
            setattr(task, field, value)
        task.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": f"Updated {len(tasks)} tasks successfully"}


@router.get("/{task_id}/comments")
async def get_task_comments(
    project_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get task comments"""
    
    # TODO: Implement when comment model is created
    return []


@router.post("/{task_id}/comments")
async def add_task_comment(
    project_id: str,
    task_id: str,
    content: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add comment to task"""
    
    # TODO: Implement when comment model is created
    return {"message": "Comment added successfully"}