# software/frontend/web/routers/files_api.py
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from software.backend.services.database_services import User, Project, TeamMember, get_session
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class FileNode(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: List['FileNode'] = []

def build_tree(path: str) -> List[FileNode]:
    """Recursively builds a file tree from a given path."""
    nodes = []
    if not os.path.exists(path):
        return nodes
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        is_dir = os.path.isdir(item_path)
        node = FileNode(name=item, path=item_path, is_dir=is_dir)
        if is_dir:
            node.children = build_tree(item_path)
        nodes.append(node)
    return nodes

@router.get("/files/user", response_model=List[FileNode])
async def get_user_files(current_user: User = Depends(get_current_user)):
    """Returns the file structure for the current user's general storage."""
    user_dir = os.path.join("storage", "users", str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    return build_tree(user_dir)

@router.get("/files/projects", response_model=List[FileNode])
async def get_projects_files(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Returns the file structure for all projects the user is a member of."""
    # Get projects with their names
    result = await db.execute(
        select(Project)
        .join(TeamMember)
        .where(TeamMember.user_id == current_user.id)
    )
    projects = result.scalars().all()
    
    # Also get owned projects
    owned_result = await db.execute(
        select(Project).where(Project.owner_id == current_user.id)
    )
    owned_projects = owned_result.scalars().all()
    
    # Combine and deduplicate
    all_projects = {p.id: p for p in projects}
    for p in owned_projects:
        all_projects[p.id] = p
    
    projects_files = []
    for project in all_projects.values():
        project_dir = os.path.join("storage", "projects", project.project_id)
        if os.path.exists(project_dir):
            projects_files.append(FileNode(
                name=f"{project.name} ({project.project_id})",
                path=project_dir,
                is_dir=True,
                children=build_tree(project_dir)
            ))
    return projects_files