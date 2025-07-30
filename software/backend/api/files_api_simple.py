"""
Simple Files API
Temporary simplified version that works with dev_server auth
Works with actual file system
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
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

class DeleteRequest(BaseModel):
    path: str

class CreateRequest(BaseModel):
    path: str
    name: str
    is_dir: bool = True

class UpdateRequest(BaseModel):
    path: str
    content: str

@router.get("/user")
async def get_user_files():
    """Get files for the current user"""
    # For now, use a default user directory
    user_dir = USER_FILES_DIR / "default_user"
    user_dir.mkdir(exist_ok=True)
    
    # Create default folders if they don't exist
    (user_dir / "projects").mkdir(exist_ok=True)
    (user_dir / "documents").mkdir(exist_ok=True)
    
    return scan_directory(user_dir, USER_FILES_DIR)

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
    if request.old_path.startswith("users"):
        base_dir = USER_FILES_DIR
        old_path = base_dir / request.old_path.replace("users/", "")
        new_path = base_dir / request.new_path.replace("users/", "")
    else:
        base_dir = PROJECT_FILES_DIR
        old_path = PROJECT_FILES_DIR / request.old_path
        new_path = PROJECT_FILES_DIR / request.new_path
    
    if not old_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        old_path.rename(new_path)
        logger.info(f"Renamed {request.old_path} to {request.new_path}")
        return {"message": "File renamed successfully", "file": path_to_file_info(new_path, base_dir)}
    except Exception as e:
        logger.error(f"Error renaming file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete")
async def delete_file(request: DeleteRequest):
    """Delete a file or folder"""
    # Determine base directory
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
    # Determine base directory
    if request.path.startswith("users"):
        base_dir = USER_FILES_DIR
        file_path = base_dir / request.path.replace("users/", "") / request.name
    else:
        base_dir = PROJECT_FILES_DIR
        file_path = PROJECT_FILES_DIR / request.path / request.name
    
    if file_path.exists():
        raise HTTPException(status_code=400, detail="File already exists")
    
    try:
        if request.is_dir:
            file_path.mkdir(parents=True, exist_ok=True)
        else:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text("")  # Create empty file
        
        logger.info(f"Created {'folder' if request.is_dir else 'file'}: {file_path}")
        return path_to_file_info(file_path, base_dir)
    except Exception as e:
        logger.error(f"Error creating file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(...)
):
    """Upload a file"""
    # Determine base directory
    if path.startswith("users"):
        base_dir = USER_FILES_DIR
        upload_path = base_dir / path.replace("users/", "") / file.filename
    else:
        base_dir = PROJECT_FILES_DIR
        upload_path = PROJECT_FILES_DIR / path / file.filename
    
    if upload_path.exists():
        raise HTTPException(status_code=400, detail="File already exists")
    
    try:
        # Ensure parent directory exists
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded file
        content = await file.read()
        upload_path.write_bytes(content)
        
        logger.info(f"Uploaded file: {file.filename} to {path}")
        return {"message": "File uploaded successfully", "file": path_to_file_info(upload_path, base_dir)}
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-folder")
async def upload_folder(
    files: List[UploadFile] = File(...),
    path: str = Form(...)
):
    """Upload multiple files as a folder"""
    uploaded_files = []
    errors = []
    
    # Determine base directory
    if path.startswith("users"):
        base_dir = USER_FILES_DIR
        base_upload_path = base_dir / path.replace("users/", "")
    else:
        base_dir = PROJECT_FILES_DIR
        base_upload_path = PROJECT_FILES_DIR / path
    
    for upload_file in files:
        try:
            upload_path = base_upload_path / upload_file.filename
            
            # Ensure parent directory exists
            upload_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save uploaded file
            content = await upload_file.read()
            upload_path.write_bytes(content)
            
            uploaded_files.append(path_to_file_info(upload_path, base_dir))
        except Exception as e:
            errors.append({"file": upload_file.filename, "error": str(e)})
    
    logger.info(f"Uploaded {len(uploaded_files)} files to {path}")
    
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
    if request.path.startswith("users"):
        base_dir = USER_FILES_DIR
        file_path = base_dir / request.path.replace("users/", "")
    else:
        base_dir = PROJECT_FILES_DIR
        file_path = PROJECT_FILES_DIR / request.path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot update content of a directory")
    
    try:
        file_path.write_text(request.content)
        logger.info(f"Updated content of {request.path}")
        return {"message": "File updated successfully", "file": path_to_file_info(file_path, base_dir)}
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