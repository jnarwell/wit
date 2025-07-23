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

from software.backend.services.database_services import get_session
from software.backend.models.database_models import Project, User
from software.backend.auth.dependencies import get_current_user
from software.backend.schemas.project_schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectStatsResponse,
    ProjectFilterParams
)

import logging

router = APIRouter(tags=["projects"])

logger = logging.getLogger(__name__)

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
    logger.info("--- Entering get_projects endpoint ---")
    try:
        logger.info("1. Building initial query...")
        query = select(Project)
        logger.info(f"   - Query type: {type(query)}")

        logger.info("2. Applying filters...")
        filters = []
        if status:
            logger.info(f"   - Applying status filter: {status}")
            filters.append(Project.status == status)
        if type:
            logger.info(f"   - Applying type filter: {type}")
            filters.append(Project.type == type)
        if team:
            logger.info(f"   - Applying team filter: {team}")
            filters.append(Project.extra_data["team"].astext == team)
        if priority:
            logger.info(f"   - Applying priority filter: {priority}")
            filters.append(Project.extra_data["priority"].astext == priority)
        if search:
            logger.info(f"   - Applying search filter: {search}")
            filters.append(
                or_(
                    Project.name.ilike(f"%{search}%"),
                    Project.description.ilike(f"%{search}%")
                )
            )
        
        if filters:
            logger.info("   - Adding filters to query...")
            query = query.where(and_(*filters))

        logger.info("3. Applying sorting...")
        logger.info(f"   - Sort by: {sort_by}, Order: {sort_order}")
        order_column = getattr(Project, sort_by)
        if sort_order == "desc":
            query = query.order_by(order_column.desc())
        else:
            query = query.order_by(order_column)

        logger.info("4. Applying pagination...")
        logger.info(f"   - Skip: {skip}, Limit: {limit}")
        query = query.offset(skip).limit(limit)

        logger.info("5. Executing query...")
        result = await db.execute(query)
        logger.info("   - Query executed successfully.")
        
        projects = result.scalars().all()
        logger.info(f"   - Found {len(projects)} projects.")

        logger.info("--- Exiting get_projects endpoint successfully ---")
        return projects

    except Exception as e:
        logger.error(f"--- CRASH in get_projects endpoint ---")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e}")
        # Re-raise the exception to let FastAPI handle the 500 error
        raise



@router.post("", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new project"""
    logger.info("--- Entering create_project endpoint ---")
    try:
        logger.info(f"1. Received project data: {project_data.dict()}")
        
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
        logger.info(f"2. Created Project object in memory: {project}")

        logger.info("3. Adding project to database session...")
        db.add(project)
        
        logger.info("4. Committing to database...")
        await db.commit()
        
        logger.info("5. Refreshing project instance from database...")
        await db.refresh(project)
        
        logger.info("--- Exiting create_project endpoint successfully ---")
        return project

    except Exception as e:
        logger.error(f"--- CRASH in create_project endpoint ---")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e}", exc_info=True)
        # Re-raise the exception to let FastAPI handle the 500 error
        raise


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