# software/backend/services/ai_project_tools.py
"""Project management tools for WIT AI assistant"""
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from services.database_services import (
    User, Project, TeamMember, Task, File, get_session
)

logger = logging.getLogger(__name__)

# Task Management Functions
async def create_task(
    db: AsyncSession, 
    user: User, 
    project_id: str, 
    name: str, 
    description: str = "",
    priority: str = "medium",
    assigned_to: Optional[str] = None,
    due_date: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new task in a project"""
    try:
        # Find the project
        result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Check if user is a member
        member_result = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == project.id, TeamMember.user_id == user.id)
            )
        )
        if not member_result.scalar_one_or_none():
            return {"status": "error", "message": "You are not a member of this project"}
        
        # Create task
        new_task = Task(
            task_id=f"TASK-{uuid.uuid4().hex[:8].upper()}",
            name=name,
            description=description,
            status="pending",
            priority=priority,
            project_id=project.id,
            assigned_to=assigned_to,
            due_date=datetime.fromisoformat(due_date) if due_date else None
        )
        db.add(new_task)
        await db.commit()
        await db.refresh(new_task)
        
        return {
            "status": "success",
            "task": {
                "id": new_task.task_id,
                "name": new_task.name,
                "description": new_task.description,
                "status": new_task.status,
                "priority": new_task.priority,
                "assigned_to": new_task.assigned_to,
                "due_date": new_task.due_date.isoformat() if new_task.due_date else None
            }
        }
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return {"status": "error", "message": str(e)}

async def list_tasks(
    db: AsyncSession,
    user: User,
    project_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None
) -> Dict[str, Any]:
    """List tasks in a project with optional filters"""
    try:
        # Find the project
        result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Build query
        query = select(Task).where(Task.project_id == project.id)
        if status:
            query = query.where(Task.status == status)
        if assigned_to:
            query = query.where(Task.assigned_to == assigned_to)
        
        result = await db.execute(query.order_by(Task.created_at.desc()))
        tasks = result.scalars().all()
        
        return {
            "status": "success",
            "tasks": [
                {
                    "id": task.task_id,
                    "name": task.name,
                    "description": task.description,
                    "status": task.status,
                    "priority": task.priority,
                    "assigned_to": task.assigned_to,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "created_at": task.created_at.isoformat()
                }
                for task in tasks
            ]
        }
    except Exception as e:
        logger.error(f"Error listing tasks: {e}")
        return {"status": "error", "message": str(e)}

async def update_task(
    db: AsyncSession,
    user: User,
    task_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    name: Optional[str] = None,
    description: Optional[str] = None
) -> Dict[str, Any]:
    """Update a task's properties"""
    try:
        # Find the task
        result = await db.execute(
            select(Task).where(Task.task_id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found"}
        
        # Check if user has permission
        member_result = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == task.project_id, TeamMember.user_id == user.id)
            )
        )
        member = member_result.scalar_one_or_none()
        if not member or member.role not in ["owner", "admin", "editor"]:
            return {"status": "error", "message": "You don't have permission to update tasks"}
        
        # Update fields
        if status is not None:
            task.status = status
        if priority is not None:
            task.priority = priority
        if assigned_to is not None:
            task.assigned_to = assigned_to
        if name is not None:
            task.name = name
        if description is not None:
            task.description = description
        
        task.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(task)
        
        return {
            "status": "success",
            "task": {
                "id": task.task_id,
                "name": task.name,
                "description": task.description,
                "status": task.status,
                "priority": task.priority,
                "assigned_to": task.assigned_to
            }
        }
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        return {"status": "error", "message": str(e)}

async def delete_task(
    db: AsyncSession,
    user: User,
    task_id: str
) -> Dict[str, Any]:
    """Delete a task"""
    try:
        # Find the task
        result = await db.execute(
            select(Task).where(Task.task_id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found"}
        
        # Check permission
        member_result = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == task.project_id, TeamMember.user_id == user.id)
            )
        )
        member = member_result.scalar_one_or_none()
        if not member or member.role not in ["owner", "admin", "editor"]:
            return {"status": "error", "message": "You don't have permission to delete tasks"}
        
        await db.delete(task)
        await db.commit()
        
        return {"status": "success", "message": f"Task {task_id} deleted"}
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        return {"status": "error", "message": str(e)}

# Team Member Management Functions
async def add_team_member(
    db: AsyncSession,
    user: User,
    project_id: str,
    username: str,
    role: str = "viewer"
) -> Dict[str, Any]:
    """Add a team member to a project"""
    try:
        # Find the project
        result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Check if user has permission
        member_result = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == project.id, TeamMember.user_id == user.id)
            )
        )
        member = member_result.scalar_one_or_none()
        if not member or member.role not in ["owner", "admin"]:
            return {"status": "error", "message": "Only project owners and admins can add members"}
        
        # Find user to add
        user_result = await db.execute(
            select(User).where(User.username == username)
        )
        user_to_add = user_result.scalar_one_or_none()
        if not user_to_add:
            return {"status": "error", "message": f"User {username} not found"}
        
        # Check if already a member
        existing = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == project.id, TeamMember.user_id == user_to_add.id)
            )
        )
        if existing.scalar_one_or_none():
            return {"status": "error", "message": f"User {username} is already a member"}
        
        # Add member
        new_member = TeamMember(
            project_id=project.id,
            user_id=user_to_add.id,
            role=role
        )
        db.add(new_member)
        await db.commit()
        
        return {
            "status": "success",
            "member": {
                "username": user_to_add.username,
                "role": role
            }
        }
    except Exception as e:
        logger.error(f"Error adding team member: {e}")
        return {"status": "error", "message": str(e)}

async def list_team_members(
    db: AsyncSession,
    user: User,
    project_id: str
) -> Dict[str, Any]:
    """List all team members of a project"""
    try:
        # Find the project
        result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Get members
        members_result = await db.execute(
            select(TeamMember, User)
            .join(User)
            .where(TeamMember.project_id == project.id)
        )
        members = members_result.all()
        
        return {
            "status": "success",
            "members": [
                {
                    "username": user.username,
                    "role": member.role,
                    "joined_at": member.created_at.isoformat() if hasattr(member, 'created_at') else None
                }
                for member, user in members
            ]
        }
    except Exception as e:
        logger.error(f"Error listing team members: {e}")
        return {"status": "error", "message": str(e)}

async def remove_team_member(
    db: AsyncSession,
    user: User,
    project_id: str,
    username: str
) -> Dict[str, Any]:
    """Remove a team member from a project"""
    try:
        # Find the project
        result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Check permission
        member_result = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == project.id, TeamMember.user_id == user.id)
            )
        )
        member = member_result.scalar_one_or_none()
        if not member or member.role not in ["owner", "admin"]:
            return {"status": "error", "message": "Only project owners and admins can remove members"}
        
        # Find user to remove
        user_result = await db.execute(
            select(User).where(User.username == username)
        )
        user_to_remove = user_result.scalar_one_or_none()
        if not user_to_remove:
            return {"status": "error", "message": f"User {username} not found"}
        
        # Find member to remove
        target_result = await db.execute(
            select(TeamMember).where(
                and_(TeamMember.project_id == project.id, TeamMember.user_id == user_to_remove.id)
            )
        )
        target_member = target_result.scalar_one_or_none()
        if not target_member:
            return {"status": "error", "message": f"User {username} is not a member of this project"}
        
        # Can't remove owner
        if target_member.role == "owner":
            return {"status": "error", "message": "Cannot remove the project owner"}
        
        await db.delete(target_member)
        await db.commit()
        
        return {"status": "success", "message": f"Removed {username} from project"}
    except Exception as e:
        logger.error(f"Error removing team member: {e}")
        return {"status": "error", "message": str(e)}

# Project Statistics Functions
async def get_project_stats(
    db: AsyncSession,
    user: User,
    project_id: str
) -> Dict[str, Any]:
    """Get comprehensive statistics for a project"""
    try:
        # Find the project
        result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Get task stats
        task_stats = await db.execute(
            select(
                Task.status,
                func.count(Task.id).label('count')
            )
            .where(Task.project_id == project.id)
            .group_by(Task.status)
        )
        task_counts = {row.status: row.count for row in task_stats}
        
        # Get member count
        member_count = await db.execute(
            select(func.count(TeamMember.id))
            .where(TeamMember.project_id == project.id)
        )
        
        # Get file count
        file_count = await db.execute(
            select(func.count(File.id))
            .where(File.project_id == project.id)
        )
        
        total_tasks = sum(task_counts.values())
        completed_tasks = task_counts.get('completed', 0)
        progress_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        return {
            "status": "success",
            "stats": {
                "project_name": project.name,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "pending_tasks": task_counts.get('pending', 0),
                "in_progress_tasks": task_counts.get('in_progress', 0),
                "progress_percentage": round(progress_percentage, 1),
                "member_count": member_count.scalar(),
                "file_count": file_count.scalar(),
                "created_at": project.created_at.isoformat(),
                "last_updated": project.updated_at.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error getting project stats: {e}")
        return {"status": "error", "message": str(e)}

# Enhanced Project Functions
async def get_project_details(
    db: AsyncSession,
    user: User,
    project_id: str
) -> Dict[str, Any]:
    """Get detailed information about a project including recent activity"""
    try:
        # Find the project with all relationships
        result = await db.execute(
            select(Project)
            .options(selectinload(Project.tasks), selectinload(Project.team_members))
            .where(Project.project_id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found"}
        
        # Check if user is a member
        is_member = any(m.user_id == user.id for m in project.team_members)
        if not is_member:
            return {"status": "error", "message": "You are not a member of this project"}
        
        # Get recent tasks
        recent_tasks = sorted(project.tasks, key=lambda t: t.created_at, reverse=True)[:5]
        
        return {
            "status": "success",
            "project": {
                "id": project.project_id,
                "name": project.name,
                "description": project.description,
                "type": project.type,
                "status": project.status,
                "priority": project.extra_data.get('priority', 'medium') if project.extra_data else 'medium',
                "deadline": project.extra_data.get('deadline') if project.extra_data else None,
                "recent_tasks": [
                    {
                        "id": task.task_id,
                        "name": task.name,
                        "status": task.status,
                        "created_at": task.created_at.isoformat()
                    }
                    for task in recent_tasks
                ]
            }
        }
    except Exception as e:
        logger.error(f"Error getting project details: {e}")
        return {"status": "error", "message": str(e)}

async def search_projects(
    db: AsyncSession,
    user: User,
    query: str
) -> Dict[str, Any]:
    """Search for projects by name or description"""
    try:
        # Search in user's projects
        result = await db.execute(
            select(Project)
            .join(TeamMember)
            .where(
                and_(
                    TeamMember.user_id == user.id,
                    or_(
                        Project.name.ilike(f"%{query}%"),
                        Project.description.ilike(f"%{query}%")
                    )
                )
            )
        )
        projects = result.scalars().all()
        
        return {
            "status": "success",
            "projects": [
                {
                    "id": project.project_id,
                    "name": project.name,
                    "description": project.description,
                    "type": project.type,
                    "status": project.status
                }
                for project in projects
            ]
        }
    except Exception as e:
        logger.error(f"Error searching projects: {e}")
        return {"status": "error", "message": str(e)}