# software/frontend/web/routers/files_api.py
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from software.backend.services.database_services import User
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class FileNode(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: List['FileNode'] = []

def get_file_structure(path: str) -> List[FileNode]:
    """Recursively builds a file tree from a given path."""
    nodes = []
    if not os.path.exists(path):
        return nodes
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        is_dir = os.path.isdir(item_path)
        node = FileNode(name=item, path=item_path, is_dir=is_dir)
        if is_dir:
            node.children = get_file_structure(item_path)
        nodes.append(node)
    return nodes

@router.get("/files/user", response_model=List[FileNode])
async def get_user_files(current_user: User = Depends(get_current_user)):
    """Returns the file structure for the current user's general storage."""
    user_dir = os.path.join("storage", "users", str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    return get_file_structure(user_dir)

@router.get("/files/project/{project_id}", response_model=List[FileNode])
async def get_project_files(project_id: str):
    """Returns the file structure for a specific project."""
    project_dir = os.path.join("storage", "projects", project_id)
    os.makedirs(project_dir, exist_ok=True)
    return get_file_structure(project_dir)
