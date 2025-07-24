# software/frontend/web/routers/team_members_router.py
from typing import List, Optional
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer

from software.backend.services.database_services import get_session, Project, User, TeamMember
from software.backend.auth.security import decode_access_token
from software.backend.services.database_services import get_user_by_username

# --- Pydantic Schemas for Team Members ---
class TeamMemberCreate(BaseModel):
    username: str  # or email
    role: str = "viewer"  # owner, admin, editor, viewer

class TeamMemberUpdate(BaseModel):
    role: str

class TeamMemberResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: Optional[str] = None
    role: str
    joined_at: Optional[datetime] = None
    avatar: Optional[str] = None

    class Config:
        orm_mode = True

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
) -> User:
    username = decode_access_token(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await get_user_by_username(db, username=username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return user

@router.post("/projects/{project_id}/members", response_model=TeamMemberResponse, status_code=201)
async def add_team_member(
    project_id: str,
    member: TeamMemberCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a team member to a project."""
    # Get the project
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user has permission (owner or admin)
    member_result = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == current_user.id)
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only project owners and admins can add members")
    
    # Find the user to add
    user_result = await db.execute(
        select(User).where(User.username == member.username)
    )
    user_to_add = user_result.scalar_one_or_none()
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is already a member
    existing_member = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == user_to_add.id)
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this project")
    
    # Add the member
    new_member = TeamMember(
        project_id=project.id,
        user_id=user_to_add.id,
        role=member.role
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    
    # Return formatted response
    return TeamMemberResponse(
        id=user_to_add.id,
        username=user_to_add.username,
        email=user_to_add.email if hasattr(user_to_add, 'email') else None,
        role=new_member.role,
        joined_at=new_member.created_at if hasattr(new_member, 'created_at') else None
    )

@router.get("/projects/{project_id}/members", response_model=List[TeamMemberResponse])
async def get_project_members(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all members of a project."""
    # Get the project
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is a member
    member_check = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == current_user.id)
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    
    # Get all members
    members_result = await db.execute(
        select(TeamMember, User).join(User).where(TeamMember.project_id == project.id)
    )
    members = members_result.all()
    
    # Format response
    return [
        TeamMemberResponse(
            id=user.id,
            username=user.username,
            email=user.email if hasattr(user, 'email') else None,
            role=member.role,
            joined_at=member.created_at if hasattr(member, 'created_at') else None
        )
        for member, user in members
    ]

@router.put("/projects/{project_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_member_role(
    project_id: str,
    user_id: uuid.UUID,
    update: TeamMemberUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a team member's role."""
    # Get the project
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is owner or admin
    member_result = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == current_user.id)
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only project owners and admins can update member roles")
    
    # Get the member to update
    target_member_result = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == user_id)
        )
    )
    target_member = target_member_result.scalar_one_or_none()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found in this project")
    
    # Can't change owner's role
    if target_member.role == "owner" and update.role != "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner's role")
    
    # Update the role
    target_member.role = update.role
    await db.commit()
    await db.refresh(target_member)
    
    # Get user info for response
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()
    
    return TeamMemberResponse(
        id=user.id,
        username=user.username,
        email=user.email if hasattr(user, 'email') else None,
        role=target_member.role,
        joined_at=target_member.created_at if hasattr(target_member, 'created_at') else None
    )

@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
async def remove_team_member(
    project_id: str,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove a team member from a project."""
    # Get the project
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is owner or admin
    member_result = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == current_user.id)
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only project owners and admins can remove members")
    
    # Get the member to remove
    target_member_result = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == user_id)
        )
    )
    target_member = target_member_result.scalar_one_or_none()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found in this project")
    
    # Can't remove the owner
    if target_member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the project owner")
    
    # Remove the member
    await db.delete(target_member)
    await db.commit()