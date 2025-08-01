"""
W.I.T. Projects API
Complete project management endpoints with team and task support
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import os
import shutil
import logging

from services.database_services import get_session, User, Project, TeamMember, Task
from schemas.project_schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectListResponse, ProjectDetailResponse
)
from schemas.task_schemas import TaskCreate, TaskUpdate, TaskResponse
from schemas.team_schemas import TeamMemberAdd, TeamMemberResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

# Import get_current_user from parent module  
# This will be resolved when router is included in main app
get_current_user = None

# Project CRUD operations
@router.post("/", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new project"""
    try:
        # Generate project ID
        project_id = f"PROJ-{uuid.uuid4().hex[:8].upper()}"
        
        # Create project
        new_project = Project(
            project_id=project_id,
            name=project.name,
            description=project.description,
            type=project.type,
            status=project.status,
            priority=project.priority,
            owner_id=current_user.id,
            extra_data=project.extra_data or {}
        )
        
        db.add(new_project)
        await db.flush()
        
        # Add owner as team member
        owner_member = TeamMember(
            project_id=new_project.id,
            user_id=current_user.id,
            role="owner"
        )
        db.add(owner_member)
        
        # Create project directory structure
        await create_project_structure(project_id, project.type)
        
        await db.commit()
        await db.refresh(new_project)
        
        return ProjectResponse.from_orm(new_project)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all projects for the current user"""
    try:
        # Base query - projects where user is owner or team member
        query = select(Project).join(
            TeamMember, Project.id == TeamMember.project_id
        ).where(
            TeamMember.user_id == current_user.id
        )
        
        # Apply filters
        if status:
            query = query.where(Project.status == status)
        if priority:
            query = query.where(Project.priority == priority)
        if search:
            query = query.where(
                or_(
                    Project.name.ilike(f"%{search}%"),
                    Project.description.ilike(f"%{search}%")
                )
            )
        
        # Get total count
        count_result = await db.execute(select(func.count()).select_from(query.alias()))
        total = count_result.scalar()
        
        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Project.created_at.desc())
        
        result = await db.execute(query)
        projects = result.scalars().unique().all()
        
        return ProjectListResponse(
            projects=[ProjectResponse.from_orm(p) for p in projects],
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Error listing projects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get detailed project information"""
    try:
        # Get project with team members and tasks
        result = await db.execute(
            select(Project)
            .options(
                selectinload(Project.team_members).selectinload(TeamMember.user),
                selectinload(Project.tasks)
            )
            .join(TeamMember)
            .where(
                and_(
                    Project.project_id == project_id,
                    TeamMember.user_id == current_user.id
                )
            )
        )
        
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get project statistics
        stats = await get_project_statistics(db, project.id)
        
        return ProjectDetailResponse(
            **ProjectResponse.from_orm(project).dict(),
            team_members=[TeamMemberResponse.from_orm(tm) for tm in project.members],
            tasks=[TaskResponse.from_orm(t) for t in project.tasks],
            statistics=stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a project"""
    try:
        # Get project and check permissions
        result = await db.execute(
            select(Project).join(TeamMember).where(
                and_(
                    Project.project_id == project_id,
                    TeamMember.user_id == current_user.id,
                    TeamMember.role.in_(["owner", "admin"])
                )
            )
        )
        
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=404, 
                detail="Project not found or insufficient permissions"
            )
        
        # Update fields
        update_data = project_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)
        
        project.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(project)
        
        return ProjectResponse.from_orm(project)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a project (owner only)"""
    try:
        # Get project and check ownership
        result = await db.execute(
            select(Project).where(
                and_(
                    Project.project_id == project_id,
                    Project.owner_id == current_user.id
                )
            )
        )
        
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=404, 
                detail="Project not found or not authorized"
            )
        
        # Delete project directory
        project_dir = os.path.join("storage", "projects", project_id)
        if os.path.exists(project_dir):
            shutil.rmtree(project_dir)
        
        # Delete from database (cascades to team members and tasks)
        await db.delete(project)
        await db.commit()
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Task management endpoints
@router.post("/{project_id}/tasks", response_model=TaskResponse)
async def create_task(
    project_id: str,
    task: TaskCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a task in a project"""
    try:
        # Check project access
        project = await get_project_with_access(db, project_id, current_user.id)
        
        # Create task
        new_task = Task(
            project_id=project.id,
            name=task.name,
            description=task.description,
            status=task.status,
            priority=task.priority,
            due_date=task.due_date
        )
        
        db.add(new_task)
        await db.commit()
        await db.refresh(new_task)
        
        return TaskResponse.from_orm(new_task)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List tasks in a project"""
    try:
        # Check project access
        project = await get_project_with_access(db, project_id, current_user.id)
        
        # Build query
        query = select(Task).where(Task.project_id == project.id)
        
        if status:
            query = query.where(Task.status == status)
        
        query = query.order_by(Task.created_at.desc())
        
        result = await db.execute(query)
        tasks = result.scalars().all()
        
        return [TaskResponse.from_orm(t) for t in tasks]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing tasks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Team member management endpoints
@router.post("/{project_id}/team", response_model=TeamMemberResponse)
async def add_team_member(
    project_id: str,
    member: TeamMemberAdd,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a team member to a project"""
    try:
        # Check project access and admin rights
        project = await get_project_with_admin_access(db, project_id, current_user.id)
        
        # Check if user exists
        user_result = await db.execute(
            select(User).where(User.username == member.username)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if already a member
        existing = await db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.project_id == project.id,
                    TeamMember.user_id == user.id
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="User already a team member")
        
        # Add team member
        new_member = TeamMember(
            project_id=project.id,
            user_id=user.id,
            role=member.role
        )
        
        db.add(new_member)
        await db.commit()
        await db.refresh(new_member)
        
        # Load user relationship
        await db.refresh(new_member, ["user"])
        
        return TeamMemberResponse.from_orm(new_member)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error adding team member: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/team", response_model=List[TeamMemberResponse])
async def list_team_members(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List team members of a project"""
    try:
        # Check project access
        project = await get_project_with_access(db, project_id, current_user.id)
        
        # Get team members
        result = await db.execute(
            select(TeamMember)
            .options(selectinload(TeamMember.user))
            .where(TeamMember.project_id == project.id)
        )
        
        members = result.scalars().all()
        
        return [TeamMemberResponse.from_orm(m) for m in members]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing team members: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions
async def get_project_with_access(
    db: AsyncSession, 
    project_id: str, 
    user_id: str
) -> Project:
    """Get project if user has access"""
    result = await db.execute(
        select(Project).join(TeamMember).where(
            and_(
                Project.project_id == project_id,
                TeamMember.user_id == user_id
            )
        )
    )
    
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

async def get_project_with_admin_access(
    db: AsyncSession, 
    project_id: str, 
    user_id: str
) -> Project:
    """Get project if user has admin access"""
    result = await db.execute(
        select(Project).join(TeamMember).where(
            and_(
                Project.project_id == project_id,
                TeamMember.user_id == user_id,
                TeamMember.role.in_(["owner", "admin"])
            )
        )
    )
    
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=404, 
            detail="Project not found or insufficient permissions"
        )
    
    return project

async def create_project_structure(project_id: str, project_type: str):
    """Create project directory structure based on type"""
    base_dir = os.path.join("storage", "projects", project_id)
    
    # Create base directory
    os.makedirs(base_dir, exist_ok=True)
    
    # Create type-specific structure
    if project_type == "software":
        dirs = ["src", "docs", "tests", "config", "scripts"]
        # Create README
        with open(os.path.join(base_dir, "README.md"), "w") as f:
            f.write(f"# Project {project_id}\n\nSoftware development project.\n")
            
    elif project_type == "hardware":
        dirs = ["schematics", "pcb", "firmware", "docs", "bom"]
        
    elif project_type == "research":
        dirs = ["papers", "data", "analysis", "references", "presentations"]
        
    elif project_type == "design":
        dirs = ["concepts", "mockups", "assets", "prototypes", "specs"]
        
    else:
        dirs = ["documents", "resources", "deliverables"]
    
    # Create subdirectories
    for dir_name in dirs:
        os.makedirs(os.path.join(base_dir, dir_name), exist_ok=True)

async def get_project_statistics(db: AsyncSession, project_id: str) -> Dict[str, Any]:
    """Get project statistics"""
    # Task statistics
    task_result = await db.execute(
        select(
            Task.status,
            func.count(Task.id).label('count')
        ).where(Task.project_id == project_id).group_by(Task.status)
    )
    
    task_stats = {row.status: row.count for row in task_result}
    total_tasks = sum(task_stats.values())
    completed_tasks = task_stats.get('completed', 0)
    
    # File count (would query file system in production)
    project_dir = os.path.join("storage", "projects", project_id)
    file_count = 0
    if os.path.exists(project_dir):
        for root, dirs, files in os.walk(project_dir):
            file_count += len(files)
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
        "task_breakdown": task_stats,
        "file_count": file_count
    }

# Add missing import
from sqlalchemy import func