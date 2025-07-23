# software/frontend/web/routers/teams_router.py
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from software.backend.services.database_services import get_session, Team, Project
from pydantic import BaseModel

# --- Pydantic Schemas for Teams ---
class TeamBase(BaseModel):
    name: str

class TeamCreate(TeamBase):
    pass

class TeamResponse(TeamBase):
    id: uuid.UUID
    project_id: uuid.UUID

    class Config:
        orm_mode = True

router = APIRouter()

@router.post("/projects/{project_id}/teams", response_model=TeamResponse, status_code=201)
async def create_team_for_project(
    project_id: str,
    team: TeamCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new team for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_team = Team(
        name=team.name,
        project_id=project.id
    )
    db.add(new_team)
    await db.commit()
    await db.refresh(new_team)
    return new_team

@router.get("/projects/{project_id}/teams", response_model=List[TeamResponse])
async def get_teams_for_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """Get all teams for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Team)
        .where(Team.project_id == project.id)
        .offset(skip)
        .limit(limit)
    )
    teams = result.scalars().all()
    return teams
