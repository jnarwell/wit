"""
W.I.T. Teams API Router

File: software/backend/routers/teams.py

Team and member management endpoints for projects
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from uuid import UUID

from ..services.database_services import get_session
from ..models.database_models import Project, User, Team, TeamMember
from ..auth.dependencies import get_current_user
from ..schemas.team_schemas import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamMemberAdd,
    TeamMemberUpdate,
    TeamMemberResponse,
    TeamInviteRequest,
    TeamRoleUpdate
)

router = APIRouter(prefix="/api/v1/projects/{project_id}/teams", tags=["teams"])


@router.get("", response_model=List[TeamResponse])
async def get_project_teams(
    project_id: str,
    include_members: bool = True,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all teams for a project"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get teams
    query = select(Team).where(Team.project_id == project.id)
    
    if include_members:
        query = query.options(selectinload(Team.members).selectinload(TeamMember.user))
    
    result = await db.execute(query)
    teams = result.scalars().all()
    
    return teams


@router.post("", response_model=TeamResponse)
async def create_team(
    project_id: str,
    team_data: TeamCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new team/subteam"""
    
    # Verify project exists and user has permission
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.owner_id != current_user.id:
        # Check if user is a team lead
        member_query = select(TeamMember).where(
            and_(
                TeamMember.user_id == current_user.id,
                TeamMember.team.has(project_id=project.id),
                TeamMember.role.in_(["lead", "admin"])
            )
        )
        member_result = await db.execute(member_query)
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to create teams")
    
    # Create team
    team = Team(
        team_id=f"TEAM-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        project_id=project.id,
        name=team_data.name,
        description=team_data.description,
        type=team_data.type or "general",
        extra_data={
            "focus_area": team_data.focus_area,
            "tools": team_data.tools or [],
            "schedule": team_data.schedule or {},
            "custom_fields": team_data.custom_fields or {}
        }
    )
    
    db.add(team)
    
    # Add creator as team lead
    team_member = TeamMember(
        team=team,
        user_id=current_user.id,
        role="lead",
        permissions=["all"]
    )
    
    db.add(team_member)
    await db.commit()
    await db.refresh(team)
    
    return team


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    project_id: str,
    team_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get team details"""
    
    query = select(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id)
        )
    ).options(selectinload(Team.members).selectinload(TeamMember.user))
    
    result = await db.execute(query)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    project_id: str,
    team_id: str,
    team_update: TeamUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update team details"""
    
    query = select(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permissions
    member_query = select(TeamMember).where(
        and_(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_(["lead", "admin"])
        )
    )
    member_result = await db.execute(member_query)
    if not member_result.scalar_one_or_none() and team.project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update team")
    
    # Update fields
    update_data = team_update.dict(exclude_unset=True)
    
    if "focus_area" in update_data:
        team.extra_data["focus_area"] = update_data.pop("focus_area")
    if "tools" in update_data:
        team.extra_data["tools"] = update_data.pop("tools")
    if "schedule" in update_data:
        team.extra_data["schedule"] = update_data.pop("schedule")
    if "custom_fields" in update_data:
        team.extra_data["custom_fields"] = update_data.pop("custom_fields")
    
    for field, value in update_data.items():
        setattr(team, field, value)
    
    team.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(team)
    
    return team


@router.delete("/{team_id}")
async def delete_team(
    project_id: str,
    team_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a team"""
    
    query = select(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id)
        )
    )
    result = await db.execute(query)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permissions
    if team.project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete team")
    
    await db.delete(team)
    await db.commit()
    
    return {"message": "Team deleted successfully"}


# Team Member Management

@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def get_team_members(
    project_id: str,
    team_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all members of a team"""
    
    query = select(TeamMember).join(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id)
        )
    ).options(selectinload(TeamMember.user))
    
    result = await db.execute(query)
    members = result.scalars().all()
    
    return members


@router.post("/{team_id}/members", response_model=TeamMemberResponse)
async def add_team_member(
    project_id: str,
    team_id: str,
    member_data: TeamMemberAdd,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a member to team"""
    
    # Get team
    team_query = select(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id)
        )
    )
    team_result = await db.execute(team_query)
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permissions
    member_query = select(TeamMember).where(
        and_(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_(["lead", "admin"])
        )
    )
    member_result = await db.execute(member_query)
    if not member_result.scalar_one_or_none() and team.project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add members")
    
    # Check if user exists
    user_query = select(User).where(User.id == member_data.user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a member
    existing_query = select(TeamMember).where(
        and_(
            TeamMember.team_id == team.id,
            TeamMember.user_id == member_data.user_id
        )
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a team member")
    
    # Add member
    team_member = TeamMember(
        team_id=team.id,
        user_id=member_data.user_id,
        role=member_data.role or "member",
        permissions=member_data.permissions or ["view", "comment"],
        extra_data={
            "skills": member_data.skills or [],
            "availability": member_data.availability or {},
            "notes": member_data.notes or ""
        }
    )
    
    db.add(team_member)
    await db.commit()
    await db.refresh(team_member)
    
    return team_member


@router.put("/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    project_id: str,
    team_id: str,
    user_id: str,
    member_update: TeamMemberUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update team member role/permissions"""
    
    # Get team member
    query = select(TeamMember).join(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id),
            TeamMember.user_id == user_id
        )
    )
    result = await db.execute(query)
    team_member = result.scalar_one_or_none()
    
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    # Check permissions
    auth_query = select(TeamMember).where(
        and_(
            TeamMember.team_id == team_member.team_id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_(["lead", "admin"])
        )
    )
    auth_result = await db.execute(auth_query)
    if not auth_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to update members")
    
    # Update member
    update_data = member_update.dict(exclude_unset=True)
    
    if "skills" in update_data:
        team_member.extra_data["skills"] = update_data.pop("skills")
    if "availability" in update_data:
        team_member.extra_data["availability"] = update_data.pop("availability")
    if "notes" in update_data:
        team_member.extra_data["notes"] = update_data.pop("notes")
    
    for field, value in update_data.items():
        setattr(team_member, field, value)
    
    team_member.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(team_member)
    
    return team_member


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    project_id: str,
    team_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove member from team"""
    
    # Get team member
    query = select(TeamMember).join(Team).where(
        and_(
            Team.team_id == team_id,
            Team.project.has(project_id=project_id),
            TeamMember.user_id == user_id
        )
    )
    result = await db.execute(query)
    team_member = result.scalar_one_or_none()
    
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    # Check permissions
    if str(current_user.id) != user_id:  # Users can remove themselves
        auth_query = select(TeamMember).where(
            and_(
                TeamMember.team_id == team_member.team_id,
                TeamMember.user_id == current_user.id,
                TeamMember.role.in_(["lead", "admin"])
            )
        )
        auth_result = await db.execute(auth_query)
        if not auth_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    await db.delete(team_member)
    await db.commit()
    
    return {"message": "Team member removed successfully"}


@router.post("/{team_id}/invite")
async def invite_to_team(
    project_id: str,
    team_id: str,
    invite_request: TeamInviteRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Send invitation to join team"""
    
    # TODO: Implement email invitation system
    # This would integrate with email service to send invitations
    
    return {
        "message": "Invitation sent successfully",
        "email": invite_request.email,
        "role": invite_request.role
    }


@router.get("/members/workload")
async def get_team_workload(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get workload distribution across all teams"""
    
    # TODO: Implement workload calculation
    # This would aggregate task assignments and estimated hours
    
    return {
        "total_members": 0,
        "workload_distribution": [],
        "overloaded_members": [],
        "available_capacity": 0
    }