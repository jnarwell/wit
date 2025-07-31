"""
Simple Files API
Temporary simplified version that works with dev_server auth
Works with actual file system
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from datetime import datetime
import logging
import json
import uuid
import os
import shutil
from pathlib import Path

router = APIRouter(tags=["files"])
logger = logging.getLogger(__name__)

# WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

# Base directory for file storage
BASE_DIR = Path(os.getenv("WIT_STORAGE_PATH", "./wit_storage"))
USER_FILES_DIR = BASE_DIR / "users"
PROJECT_FILES_DIR = BASE_DIR / "projects"

# Ensure directories exist
USER_FILES_DIR.mkdir(parents=True, exist_ok=True)
PROJECT_FILES_DIR.mkdir(parents=True, exist_ok=True)

def path_to_file_info(path: Path, base_path: Path) -> Dict[str, Any]:
    """Convert a file system path to file info dict"""
    relative_path = path.relative_to(base_path)
    stat = path.stat()
    
    file_info = {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, str(path))),
        "name": path.name,
        "is_dir": path.is_dir(),
        "path": str(relative_path),
        "size": stat.st_size if path.is_file() else 0,
        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
    }
    
    if path.is_dir():
        file_info["children"] = []
    
    return file_info

def scan_directory(directory: Path, base_path: Path) -> List[Dict[str, Any]]:
    """Scan directory and return file info list"""
    files = []
    try:
        for item in directory.iterdir():
            if not item.name.startswith('.'):  # Skip hidden files
                files.append(path_to_file_info(item, base_path))
    except PermissionError:
        logger.warning(f"Permission denied accessing {directory}")
    
    return files

# Pydantic models for requests
class RenameRequest(BaseModel):
    old_path: str
    new_path: str
    base_dir: Optional[str] = None
    project_id: Optional[str] = None

class DeleteRequest(BaseModel):
    path: str
    base_dir: Optional[str] = None
    project_id: Optional[str] = None

class CreateRequest(BaseModel):
    path: str
    base_dir: str
    project_id: Optional[str] = None
    name: Optional[str] = None
    is_dir: Optional[bool] = None

class UpdateRequest(BaseModel):
    path: str
    content: str
    base_dir: Optional[str] = None
    project_id: Optional[str] = None

@router.get("/user")
async def get_user_files():
    """Get files for the current user"""
    # For now, use a default user directory
    user_dir = USER_FILES_DIR / "default_user"
    user_dir.mkdir(exist_ok=True)
    
    # Create default folders if they don't exist
    (user_dir / "projects").mkdir(exist_ok=True)
    (user_dir / "documents").mkdir(exist_ok=True)
    
    # Use user_dir as base so paths don't include "default_user"
    return scan_directory(user_dir, user_dir)

@router.get("/projects")
async def get_project_files():
    """Get project files for the current user"""
    # Ensure projects directory exists
    PROJECT_FILES_DIR.mkdir(exist_ok=True)
    
    return scan_directory(PROJECT_FILES_DIR, PROJECT_FILES_DIR)

@router.post("/rename")
async def rename_file(request: RenameRequest):
    """Rename a file or folder"""
    # Determine base directory
    if request.base_dir == "user" or request.base_dir == "users":
        base_dir = USER_FILES_DIR / "default_user"
        old_path = base_dir / request.old_path
        new_path = base_dir / request.new_path
        info_base = base_dir
    elif request.base_dir == "project" and request.project_id:
        base_dir = PROJECT_FILES_DIR / request.project_id
        # Remove project_id prefix from paths if present
        clean_old_path = request.old_path
        if clean_old_path.startswith(f"{request.project_id}/"):
            clean_old_path = clean_old_path[len(request.project_id) + 1:]
        clean_new_path = request.new_path
        if clean_new_path.startswith(f"{request.project_id}/"):
            clean_new_path = clean_new_path[len(request.project_id) + 1:]
        old_path = base_dir / clean_old_path
        new_path = base_dir / clean_new_path
        info_base = base_dir
    else:
        # Fallback to old logic
        if request.old_path.startswith("users"):
            base_dir = USER_FILES_DIR
            old_path = base_dir / request.old_path.replace("users/", "")
            new_path = base_dir / request.new_path.replace("users/", "")
            info_base = USER_FILES_DIR
        else:
            base_dir = PROJECT_FILES_DIR
            old_path = PROJECT_FILES_DIR / request.old_path
            new_path = PROJECT_FILES_DIR / request.new_path
            info_base = PROJECT_FILES_DIR
    
    if not old_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        old_path.rename(new_path)
        logger.info(f"Renamed {request.old_path} to {request.new_path}")
        return {"message": "File renamed successfully", "file": path_to_file_info(new_path, info_base)}
    except Exception as e:
        logger.error(f"Error renaming file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete")
async def delete_file(request: DeleteRequest):
    """Delete a file or folder"""
    # Determine base directory
    if request.base_dir == "user" or request.base_dir == "users":
        file_path = USER_FILES_DIR / "default_user" / request.path
    elif request.base_dir == "project" and request.project_id:
        # Remove project_id prefix from path if present
        clean_path = request.path
        if clean_path.startswith(f"{request.project_id}/"):
            clean_path = clean_path[len(request.project_id) + 1:]
        file_path = PROJECT_FILES_DIR / request.project_id / clean_path
    else:
        # Fallback to old logic
        if request.path.startswith("users"):
            file_path = USER_FILES_DIR / request.path.replace("users/", "")
        else:
            file_path = PROJECT_FILES_DIR / request.path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        if file_path.is_dir():
            shutil.rmtree(file_path)
        else:
            file_path.unlink()
        logger.info(f"Deleted {request.path}")
        return {"message": "File deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create")
async def create_file(request: CreateRequest):
    """Create a new file or folder"""
    # Clean and parse the path
    path = request.path.strip()
    
    # Handle different path formats
    if path.startswith('/'):
        path = path[1:]  # Remove leading slash
    
    # Determine if it's a directory
    is_dir = path.endswith('/')
    
    # Clean the path for processing
    clean_path = path.rstrip('/')
    
    # Extract the name and parent path
    if '/' in clean_path:
        path_parts = clean_path.split('/')
        name = path_parts[-1]
        parent_parts = path_parts[:-1]
        # Clean up parent path
        parent_path = '/'.join(parent_parts)
    else:
        name = clean_path
        parent_path = ''
    
    # If name is empty, use a default
    if not name:
        name = 'untitled.md' if not is_dir else 'untitled'
    
    # Log for debugging
    logger.info(f"Creating file/folder - Path: {request.path}, Name: {name}, Parent: {parent_path}, Is Dir: {is_dir}, Base Dir: {request.base_dir}")
    
    # Determine base directory
    if request.base_dir == 'users' or request.base_dir == 'user':
        base_dir = USER_FILES_DIR / "default_user"
        if parent_path:
            # Remove any 'users' prefix from parent_path if present
            if parent_path.startswith('users/'):
                parent_path = parent_path[6:]
            elif parent_path == 'users':
                parent_path = ''
            file_path = base_dir / parent_path / name
        else:
            file_path = base_dir / name
    elif request.base_dir == 'project' and request.project_id:
        base_dir = PROJECT_FILES_DIR / request.project_id
        # Remove project ID from path if it's included
        if parent_path.startswith(request.project_id + '/'):
            parent_path = parent_path[len(request.project_id) + 1:]
        elif parent_path == request.project_id:
            parent_path = ''
        
        if parent_path:
            file_path = base_dir / parent_path / name
        else:
            file_path = base_dir / name
    else:
        # This shouldn't happen with proper base_dir
        raise HTTPException(status_code=400, detail=f"Invalid base_dir: {request.base_dir}")
    
    # Check if already exists
    if file_path.exists():
        raise HTTPException(status_code=400, detail=f"File already exists: {name}")
    
    try:
        if is_dir:
            file_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {file_path}")
        else:
            # Ensure parent directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)
            # Create empty file
            file_path.write_text("")
            logger.info(f"Created file: {file_path}")
        
        # Return file info
        if request.base_dir == 'users' or request.base_dir == 'user':
            return_base = USER_FILES_DIR / "default_user"
        elif request.project_id:
            return_base = PROJECT_FILES_DIR / request.project_id
        else:
            return_base = PROJECT_FILES_DIR
            
        return path_to_file_info(file_path, return_base)
    except Exception as e:
        logger.error(f"Error creating file/folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(""),
    base_dir: str = Form(...),
    project_id: Optional[str] = Form(None)
):
    """Upload a file"""
    # Determine base directory
    if base_dir == "users" or base_dir == "user":
        storage_base = USER_FILES_DIR / "default_user"
        if path:
            upload_path = storage_base / path / file.filename
        else:
            upload_path = storage_base / file.filename
    elif base_dir == "project" and project_id:
        storage_base = PROJECT_FILES_DIR / project_id
        if path:
            upload_path = storage_base / path / file.filename
        else:
            upload_path = storage_base / file.filename
    else:
        # Fallback to old logic
        if path.startswith("users"):
            storage_base = USER_FILES_DIR
            upload_path = storage_base / path.replace("users/", "") / file.filename
        else:
            storage_base = PROJECT_FILES_DIR
            upload_path = storage_base / path / file.filename
    
    if upload_path.exists():
        raise HTTPException(status_code=400, detail="File already exists")
    
    try:
        # Ensure parent directory exists
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded file
        content = await file.read()
        upload_path.write_bytes(content)
        
        logger.info(f"Uploaded file: {file.filename} to {path}")
        # Use correct base directory for file info
        if base_dir == "users" or base_dir == "user":
            info_base = USER_FILES_DIR / "default_user"
        else:
            info_base = PROJECT_FILES_DIR
        return {"message": "File uploaded successfully", "file": path_to_file_info(upload_path, info_base)}
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-folder")
async def upload_folder(
    files: List[UploadFile] = File(...),
    base_path: str = Form(...),
    base_dir: str = Form(...),
    project_id: Optional[str] = Form(None)
):
    """Upload multiple files as a folder"""
    uploaded_files = []
    errors = []
    
    # Determine base directory
    if base_dir == "users" or base_dir == "user":
        storage_base = USER_FILES_DIR / "default_user"
        if base_path:
            base_upload_path = storage_base / base_path
        else:
            base_upload_path = storage_base
    elif base_dir == "project" and project_id:
        storage_base = PROJECT_FILES_DIR / project_id
        if base_path:
            base_upload_path = storage_base / base_path
        else:
            base_upload_path = storage_base
    else:
        # Fallback to old logic
        if base_path.startswith("users"):
            storage_base = USER_FILES_DIR
            base_upload_path = storage_base / base_path.replace("users/", "")
        else:
            storage_base = PROJECT_FILES_DIR
            base_upload_path = storage_base / base_path
    
    for upload_file in files:
        try:
            upload_path = base_upload_path / upload_file.filename
            
            # Ensure parent directory exists
            upload_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save uploaded file
            content = await upload_file.read()
            upload_path.write_bytes(content)
            
            # Use correct base directory for file info
            if base_dir == "users" or base_dir == "user":
                info_base = USER_FILES_DIR / "default_user"
            else:
                info_base = PROJECT_FILES_DIR / project_id if project_id else PROJECT_FILES_DIR
            uploaded_files.append(path_to_file_info(upload_path, info_base))
        except Exception as e:
            errors.append({"file": upload_file.filename, "error": str(e)})
    
    logger.info(f"Uploaded {len(uploaded_files)} files to {base_path}")
    
    result = {
        "message": f"Uploaded {len(uploaded_files)} files successfully",
        "files": uploaded_files
    }
    if errors:
        result["errors"] = errors
    
    return result

@router.put("/update")
async def update_file(request: UpdateRequest):
    """Update file content"""
    # Determine file path
    if request.base_dir == "user" or request.base_dir == "users":
        base_dir = USER_FILES_DIR / "default_user"
        file_path = base_dir / request.path
        info_base = base_dir
    elif request.base_dir == "project" and request.project_id:
        base_dir = PROJECT_FILES_DIR / request.project_id
        # Remove project_id prefix from path if present
        clean_path = request.path
        if clean_path.startswith(f"{request.project_id}/"):
            clean_path = clean_path[len(request.project_id) + 1:]
        file_path = base_dir / clean_path
        info_base = base_dir
    else:
        # Fallback to old logic
        if request.path.startswith("users"):
            base_dir = USER_FILES_DIR
            file_path = base_dir / request.path.replace("users/", "")
            info_base = USER_FILES_DIR
        else:
            base_dir = PROJECT_FILES_DIR
            file_path = PROJECT_FILES_DIR / request.path
            info_base = PROJECT_FILES_DIR
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot update content of a directory")
    
    try:
        file_path.write_text(request.content)
        logger.info(f"Updated content of {request.path}")
        return {"message": "File updated successfully", "file": path_to_file_info(file_path, info_base)}
    except Exception as e:
        logger.error(f"Error updating file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{file_id}")
async def delete_file_by_id(file_id: str):
    """Delete a file by ID"""
    # Since we're using filesystem, we need to find the file by scanning directories
    # This is inefficient but works for development
    
    # Search in user files
    for item in USER_FILES_DIR.rglob("*"):
        if str(uuid.uuid5(uuid.NAMESPACE_DNS, str(item))) == file_id:
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                logger.info(f"Deleted file with ID: {file_id}")
                return {"message": "File deleted successfully"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    
    # Search in project files
    for item in PROJECT_FILES_DIR.rglob("*"):
        if str(uuid.uuid5(uuid.NAMESPACE_DNS, str(item))) == file_id:
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                logger.info(f"Deleted file with ID: {file_id}")
                return {"message": "File deleted successfully"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/content")
async def get_file_content(
    path: str = Query(..., description="File path"),
    base_dir: str = Query(..., description="Base directory (users/project)"),
    project_id: Optional[str] = Query(None, description="Project ID if applicable")
):
    """Get the content of a specific file"""
    # Determine the file path
    if base_dir == "users" or base_dir == "user":
        file_path = USER_FILES_DIR / "default_user" / path
    elif base_dir == "project" and project_id:
        # Remove project_id prefix from path if present
        clean_path = path
        if path.startswith(f"{project_id}/"):
            clean_path = path[len(project_id) + 1:]
        file_path = PROJECT_FILES_DIR / project_id / clean_path
    else:
        file_path = PROJECT_FILES_DIR / path
    
    # Check if file exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if it's a file (not a directory)
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory, not a file")
    
    try:
        # Read file content
        content = file_path.read_text(encoding='utf-8')
        return {
            "content": content,
            "path": str(path),
            "size": file_path.stat().st_size,
            "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
        }
    except UnicodeDecodeError:
        # If text reading fails, return as binary indication
        return {
            "content": None,
            "path": str(path),
            "size": file_path.stat().st_size,
            "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
            "binary": True,
            "message": "File is binary and cannot be displayed as text"
        }
    except Exception as e:
        logger.error(f"Error reading file content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{project_id}")
async def get_project_specific_files(project_id: str):
    """Get files for a specific project"""
    project_dir = PROJECT_FILES_DIR / project_id
    
    # Create project directory if it doesn't exist
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Use project_dir as base so paths don't include project_id prefix
    return scan_directory(project_dir, project_dir)

@router.websocket("/ws/project/{project_id}")
async def websocket_project_endpoint(websocket: WebSocket, project_id: str):
    """WebSocket endpoint for real-time project file updates"""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Send initial project files
        project_dir = PROJECT_FILES_DIR / project_id
        if project_dir.exists():
            files = scan_directory(project_dir, PROJECT_FILES_DIR)
            await websocket.send_json({
                "type": "files",
                "data": files
            })
        
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Echo back for now
            await websocket.send_json({
                "type": "ack",
                "message": f"Received: {message.get('type', 'unknown')}"
            })
            
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info(f"Client disconnected from project {project_id}")
    except Exception as e:
        logger.error(f"WebSocket error for project {project_id}: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)

@router.websocket("/ws/files")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time file updates"""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Echo back for now
            await websocket.send_json({
                "type": "ack",
                "message": f"Received: {message.get('type', 'unknown')}"
            })
            
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)