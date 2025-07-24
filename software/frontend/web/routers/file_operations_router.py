# software/frontend/web/routers/file_operations_router.py
import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from pydantic import BaseModel
from typing import Annotated, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from software.backend.services.database_services import User, TeamMember, Project, get_session
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class FileContentResponse(BaseModel):
    content: str

class FileUpdateRequest(BaseModel):
    path: str
    content: str
    base_dir: str
    project_id: str = None

class FileOperationRequest(BaseModel):
    path: str
    new_path: str = None
    base_dir: str
    project_id: str = None

async def get_project_member_role(db: AsyncSession, project_id: str, user_id: uuid.UUID) -> str:
    result = await db.execute(
        select(TeamMember.role)
        .join(Project)
        .where(Project.project_id == project_id)
        .where(TeamMember.user_id == user_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this project.")
    return role

def get_base_dir(base_dir_type: str, user: User, project_id: str = None) -> str:
    if base_dir_type == 'user':
        return os.path.join("storage", "users", str(user.id))
    if base_dir_type == 'project':
        if not project_id:
            raise HTTPException(status_code=400, detail="Project ID is required.")
        return os.path.join("storage", "projects", project_id)
    raise HTTPException(status_code=400, detail="Invalid base directory type.")

@router.get("/files/content", response_model=FileContentResponse)
async def get_file_content(
    path: str,
    base_dir: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user)
):
    base_directory = get_base_dir(base_dir, current_user, project_id)
    file_path = validate_path(base_directory, path)
    
    try:
        with open(file_path, "r") as f:
            content = f.read()
        return FileContentResponse(content=content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def validate_path(base_dir: str, path: str):
    abs_base_dir = os.path.abspath(base_dir)
    
    # If the path from the frontend already contains the base directory, use it directly.
    # Otherwise, join it with the base directory.
    if base_dir in path:
        full_path = os.path.abspath(path)
    else:
        full_path = os.path.abspath(os.path.join(abs_base_dir, path))

    if not full_path.startswith(abs_base_dir):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied.")
        
    return full_path

async def check_permissions(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    base_dir: str = Form(...),
    project_id: str = Form(None)
):
    if base_dir == 'project':
        role = await get_project_member_role(db, project_id, current_user.id)
        if role not in ['owner', 'admin', 'editor']:
            raise HTTPException(status_code=403, detail="You do not have permission to modify files in this project.")

@router.post("/files/upload", dependencies=[Depends(check_permissions)])
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(...),
    base_dir: str = Form(...),
    project_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    base_directory = get_base_dir(base_dir, current_user, project_id)
    upload_path = os.path.join(base_directory, file.filename)
    validate_path(base_directory, upload_path)
    try:
        os.makedirs(os.path.dirname(upload_path), exist_ok=True)
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"message": f"File '{file.filename}' uploaded successfully to '{path}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/upload-folder", dependencies=[Depends(check_permissions)])
async def upload_folder(
    files: List[UploadFile] = File(...),
    base_path: str = Form(...),
    base_dir: str = Form(...),
    project_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    base_directory = get_base_dir(base_dir, current_user, project_id)
    for file in files:
        upload_path = os.path.join(base_directory, base_path, file.filename)
        validate_path(base_directory, upload_path)
        try:
            os.makedirs(os.path.dirname(upload_path), exist_ok=True)
            with open(upload_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not upload {file.filename}: {e}")
    return {"message": "Folder uploaded successfully."}

@router.post("/files/create")
async def create_file_or_folder(
    data: FileOperationRequest,
    current_user: User = Depends(get_current_user)
):
    base_dir = get_base_dir(data.base_dir, current_user, data.project_id)
    path = validate_path(base_dir, data.path)
    
    try:
        if data.path.endswith('/'):
            os.makedirs(path, exist_ok=True)
            return {"message": f"Directory created: {data.path}"}
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write('')
            return {"message": f"File created: {data.path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/rename")
async def rename_file_or_folder(
    data: FileOperationRequest,
    current_user: User = Depends(get_current_user)
):
    base_dir = get_base_dir(data.base_dir, current_user, data.project_id)
    old_path = validate_path(base_dir, data.path)
    new_path = validate_path(base_dir, data.new_path)
    
    try:
        os.rename(old_path, new_path)
        return {"message": "Renamed successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/delete")
async def delete_file_or_folder(
    data: FileOperationRequest,
    current_user: User = Depends(get_current_user)
):
    base_dir = get_base_dir(data.base_dir, current_user, data.project_id)
    path = validate_path(base_dir, data.path)
    
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return {"message": "Deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/update")
async def update_file(
    data: FileUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    base_dir = get_base_dir(data.base_dir, current_user, data.project_id)
    path = validate_path(base_dir, data.path)
    
    try:
        with open(path, "w") as f:
            f.write(data.content)
        return {"message": "File updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
