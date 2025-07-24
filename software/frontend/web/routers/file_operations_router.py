# software/frontend/web/routers/file_operations_router.py
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from pydantic import BaseModel
from typing import Annotated, List

from software.backend.services.database_services import User
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class FileOperationRequest(BaseModel):
    path: str
    new_path: str = None
    base_dir: str # 'user' or 'project'
    project_id: str = None

def get_base_dir(base_dir_type: str, user: User, project_id: str = None) -> str:
    """Determines the base directory based on the request."""
    if base_dir_type == 'user':
        return os.path.join("storage", "users", str(user.id))
    elif base_dir_type == 'project':
        if not project_id:
            raise HTTPException(status_code=400, detail="Project ID is required for project files.")
        return os.path.join("storage", "projects", project_id)
    raise HTTPException(status_code=400, detail="Invalid base directory type.")

def validate_path(base_dir: str, path: str):
    """Security check to prevent path traversal attacks."""
    abs_base_dir = os.path.abspath(base_dir)
    abs_path = os.path.abspath(path)
    if not abs_path.startswith(abs_base_dir):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied.")
    return abs_path

@router.post("/files/upload-folder")
async def upload_folder(
    files: List[UploadFile] = File(...),
    base_path: str = Form(...),
    base_dir: str = Form(...),
    project_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Handles folder uploads."""
    base_directory = get_base_dir(base_dir, current_user, project_id)
    
    for file in files:
        # The filename from the client includes the relative path
        upload_path = os.path.join(base_directory, base_path, file.filename)
        validate_path(base_directory, upload_path)
        
        try:
            os.makedirs(os.path.dirname(upload_path), exist_ok=True)
            with open(upload_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not upload {file.filename}: {e}")
            
    return {"message": "Folder uploaded successfully."}

@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(...),
    base_dir: str = Form(...),
    project_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Handles file uploads."""
    base_directory = get_base_dir(base_dir, current_user, project_id)
    upload_path = os.path.join(base_directory, file.filename)
    
    # Validate the final path
    validate_path(base_directory, upload_path)

    try:
        os.makedirs(os.path.dirname(upload_path), exist_ok=True)
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"message": f"File '{file.filename}' uploaded successfully to '{path}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/create")
async def create_file_or_folder(
    data: Annotated[FileOperationRequest, Body(embed=True)],
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
    data: Annotated[FileOperationRequest, Body(embed=True)],
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
    data: Annotated[FileOperationRequest, Body(embed=True)],
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