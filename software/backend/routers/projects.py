"""
W.I.T. Projects API Router

File: software/backend/routers/projects.py

Comprehensive project management endpoints
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from uuid import UUID

from ..services.database_services import get_session
from ..models.database_models import Project, User
from ..auth.dependencies import get_current_user
from ..schemas.project_schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectStatsResponse,
    ProjectFilterParams
)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    type: Optional[str] = None,
    team: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("created_at", regex="^(created_at|updated_at|name|priority|deadline)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all projects with filtering and pagination"""
    
    # Build query
    query = select(Project)
    
    # Apply filters
    filters = []
    if status:
        filters.append(Project.status == status)
    if type:
        filters.append(Project.type == type)
    if team:
        filters.append(Project.extra_data["team"].astext == team)
    if priority:
        filters.append(Project.extra_data["priority"].astext == priority)
    if search:
        filters.append(
            or_(
                Project.name.ilike(f"%{search}%"),
                Project.description.ilike(f"%{search}%")
            )
        )
    
    if filters:
        query = query.where(and_(*filters))
    
    # Apply sorting
    order_column = getattr(Project, sort_by)
    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    projects = result.scalars().all()
    
    return projects


@router.post("", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new project"""
    
    # Create project instance
    project = Project(
        project_id=f"PROJ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        name=project_data.name,
        description=project_data.description,
        type=project_data.type,
        status=project_data.status or "planning",
        owner_id=current_user.id,
        extra_data={
            "team": project_data.team,
            "priority": project_data.priority,
            "deadline": project_data.deadline.isoformat() if project_data.deadline else None,
            "budget": project_data.budget,
            "estimated_hours": project_data.estimated_hours,
            "tags": project_data.tags or [],
            "custom_fields": project_data.custom_fields or {}
        }
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    return project


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get detailed project information"""
    
    # Query project with related data
    query = select(Project).where(Project.project_id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get additional stats
    # TODO: Add queries for task count, team members, etc.
    
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update project details"""
    
    # Get project
    query = select(Project).where(Project.project_id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check permissions
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    
    # Update fields
    update_data = project_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["team", "priority", "deadline", "budget", "estimated_hours", "tags", "custom_fields"]:
            project.extra_data[field] = value
        else:
            setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(project)
    
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a project"""
    
    # Get project
    query = select(Project).where(Project.project_id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check permissions
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
    
    await db.delete(project)
    await db.commit()
    
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
async def get_project_stats(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get project statistics and metrics"""
    
    # TODO: Implement actual statistics queries
    # This will include task completion rates, budget usage, time tracking, etc.
    
    return {
        "project_id": project_id,
        "total_tasks": 0,
        "completed_tasks": 0,
        "completion_percentage": 0.0,
        "budget_used": 0.0,
        "hours_logged": 0,
        "team_members": 0,
        "upcoming_deadlines": [],
        "recent_activity": []
    }


@router.post("/{project_id}/duplicate", response_model=ProjectResponse)
async def duplicate_project(
    project_id: str,
    new_name: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Duplicate an existing project"""
    
    # Get original project
    query = select(Project).where(Project.project_id == project_id)
    result = await db.execute(query)
    original = result.scalar_one_or_none()
    
    if not original:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create duplicate
    duplicate = Project(
        project_id=f"PROJ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        name=new_name,
        description=original.description,
        type=original.type,
        status="planning",  # Reset status
        owner_id=current_user.id,
        extra_data=original.extra_data.copy()
    )
    
    db.add(duplicate)
    await db.commit()
    await db.refresh(duplicate)
    
    return duplicate


@router.post("/{project_id}/archive")
async def archive_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Archive a project"""
    
    # Get project
    query = select(Project).where(Project.project_id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check permissions
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to archive this project")
    
    project.status = "archived"
    project.extra_data["archived_at"] = datetime.utcnow().isoformat()
    
    await db.commit()
    
    return {"message": "Project archived successfully"}


@router.post("/{project_id}/restore")
async def restore_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Restore an archived project"""
    
    # Get project
    query = select(Project).where(Project.project_id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check permissions
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to restore this project")
    
    if project.status != "archived":
        raise HTTPException(status_code=400, detail="Project is not archived")
    
    project.status = "active"
    project.extra_data.pop("archived_at", None)
    
    await db.commit()
    
    return {"message": "Project restored successfully"}