# software/frontend/web/routers/projects_router.py
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer

from software.backend.services.database_services import get_session, Project, User, TeamMember
from software.backend.auth.security import decode_access_token
from software.backend.services.database_services import get_user_by_username

# --- Pydantic Schemas for Projects ---
class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    type: str
    status: str
    extra_data: dict = {}

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: uuid.UUID
    project_id: str
    owner_id: uuid.UUID

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

@router.post("", response_model=ProjectResponse, status_code=201)
@router.post("/", response_model=ProjectResponse, status_code=201, include_in_schema=False)
async def create_project(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new project for the current user."""
    new_project = Project(
        project_id=f"PROJ-{uuid.uuid4().hex[:8].upper()}",
        name=project.name,
        description=project.description,
        type=project.type,
        status=project.status,
        extra_data=project.extra_data,
        owner_id=current_user.id
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    # Add the creator as the owner
    new_member = TeamMember(
        project_id=new_project.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_project)
    
    return new_project

@router.get("", response_model=List[ProjectResponse])
@router.get("/", response_model=List[ProjectResponse], include_in_schema=False)
async def get_projects(
    db: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """Get all projects."""
    result = await db.execute(select(Project).offset(skip).limit(limit))
    projects = result.scalars().all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_session)
):
    """Get a single project by its public ID."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")

    for key, value in project_update.dict().items():
        setattr(project, key, value)
    
    await db.commit()
    await db.refresh(project)
    return project

@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a project."""
    result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Optional: Check if the current user owns the project
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")

    await db.delete(project)
    await db.commit()
    return