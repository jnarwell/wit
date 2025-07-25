# software/frontend/web/routers/project_files_router.py
from typing import List
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from software.backend.services.database_services import get_session, Project, User
from software.frontend.web.routers.files_api import FileNode, build_tree
from software.backend.auth.security import decode_access_token
from software.backend.services.database_services import get_user_by_username
from fastapi.security import OAuth2PasswordBearer

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

router = APIRouter()

@router.get("/files/project/{project_id}", response_model=List[FileNode])
async def get_project_files(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> List[FileNode]:
    """Get all files for a specific project."""
    # Verify project exists and user has access
    from sqlalchemy import select
    result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if user has access (simplified - you might want more complex permission checks)
    from software.backend.services.database_services import TeamMember
    from sqlalchemy import and_
    member_result = await db.execute(
        select(TeamMember).where(
            and_(TeamMember.project_id == project.id, TeamMember.user_id == current_user.id)
        )
    )
    if not member_result.scalar_one_or_none() and project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    # Get project files
    project_dir = f"storage/projects/{project_id}"
    
    if not os.path.exists(project_dir):
        os.makedirs(project_dir, exist_ok=True)
        return []
    
    return build_tree(project_dir)