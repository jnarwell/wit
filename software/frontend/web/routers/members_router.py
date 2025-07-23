# software/frontend/web/routers/members_router.py
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from software.backend.services.database_services import get_session, TeamMember, Project, User
from software.backend.schemas.user_schemas import User as UserSchema
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class MemberAdd(BaseModel):
    username: str
    role: str = "viewer"

async def get_project_member(db: AsyncSession, project_id: str, user_id: uuid.UUID) -> TeamMember:
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return None
    
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.project_id == project.id)
        .where(TeamMember.user_id == user_id)
    )
    return result.scalars().first()

async def require_owner_or_admin(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    member = await get_project_member(db, project_id, current_user.id)
    if not member or member.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage members")

@router.post("/{project_id}/members", response_model=UserSchema, status_code=201, dependencies=[Depends(require_owner_or_admin)])
async def add_member_to_project(
    project_id: str,
    member: MemberAdd,
    db: AsyncSession = Depends(get_session),
):
    """Add a user to a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(select(User).where(User.username == member.username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_member = TeamMember(
        project_id=project.id,
        user_id=user.id,
        role=member.role
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    return user

@router.get("/{project_id}/members", response_model=List[UserSchema])
async def get_members_for_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
):
    """Get all members for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(User)
        .join(TeamMember)
        .where(TeamMember.project_id == project.id)
    )
    members = result.scalars().all()
    return members

@router.delete("/{project_id}/members/{user_id}", status_code=204, dependencies=[Depends(require_owner_or_admin)])
async def remove_member_from_project(
    project_id: str,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
):
    """Remove a user from a project."""
    member = await get_project_member(db, project_id, user_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in project")

    await db.delete(member)
    await db.commit()
    return
