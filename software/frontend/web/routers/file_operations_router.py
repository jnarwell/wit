# software/frontend/web/routers/file_operations_router.py
import os
import shutil
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Annotated, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from software.backend.services.database_services import User, TeamMember, Project, get_session
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# --- WebSocket Connection Manager ---
active_file_connections: List[WebSocket] = []

async def broadcast_file_update():
    """Broadcast a file system update to all connected WebSocket clients."""
    if active_file_connections:
        message = {"type": "refresh_files"}
        disconnected_clients = []
        for connection in active_file_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected_clients.append(connection)
        
        for client in disconnected_clients:
            active_file_connections.remove(client)

class FileContentResponse(BaseModel):
    content: str

class FileUpdateRequest(BaseModel):
    path: str
    content: str
    base_dir: str
    project_id: Optional[str] = None

class FileOperationRequest(BaseModel):
    path: str
    new_path: str = None
    base_dir: str
    project_id: Optional[str] = None

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
        with open(file_path, "rb") as f:
            binary_content = f.read()
        try:
            content = binary_content.decode("utf-8")
        except UnicodeDecodeError:
            content = f"Cannot display binary file: {os.path.basename(path)}"
        return FileContentResponse(content=content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files/parse", response_model=FileContentResponse)
async def parse_document(
    path: str,
    base_dir: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user)
):
    """Parse document files (RTF, DOCX) and return their text content."""
    base_directory = get_base_dir(base_dir, current_user, project_id)
    file_path = validate_path(base_directory, path)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.rtf':
            # For RTF files, extract text
            import striprtf
            with open(file_path, "r", encoding='utf-8', errors='ignore') as f:
                rtf_content = f.read()
            content = striprtf.rtf_to_text(rtf_content)
        elif file_ext == '.docx':
            # For DOCX files, use python-docx
            from docx import Document
            doc = Document(file_path)
            paragraphs = []
            for para in doc.paragraphs:
                if para.text.strip():
                    paragraphs.append(para.text)
            content = '\n\n'.join(paragraphs)
        elif file_ext == '.doc':
            raise HTTPException(
                status_code=501,
                detail="Legacy .doc format is not supported. Please convert to .docx format."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. This endpoint only supports RTF and DOCX files."
            )
            
        return FileContentResponse(content=content)
    
    except ImportError as e:
        if 'striprtf' in str(e):
            raise HTTPException(status_code=501, detail="RTF support not installed. Run: pip install striprtf")
        elif 'docx' in str(e):
            raise HTTPException(status_code=501, detail="DOCX support not installed. Run: pip install python-docx")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error parsing document {file_path}: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error parsing document: {str(e)}")

@router.get("/files/download")
async def download_file(
    path: str,
    base_dir: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user)
):
    """Download a file, supporting both text and binary files."""
    base_directory = get_base_dir(base_dir, current_user, project_id)
    file_path = validate_path(base_directory, path)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")
    
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail="Path is not a file.")
    
    # Determine MIME type based on file extension
    file_ext = os.path.splitext(file_path)[1].lower()
    media_type = "application/octet-stream"  # Default binary type
    
    if file_ext == ".pdf":
        media_type = "application/pdf"
    elif file_ext in [".doc", ".docx"]:
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif file_ext in [".txt", ".log"]:
        media_type = "text/plain"
    elif file_ext == ".json":
        media_type = "application/json"
    elif file_ext == ".csv":
        media_type = "text/csv"
    # Image types
    elif file_ext in [".png"]:
        media_type = "image/png"
    elif file_ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif file_ext in [".gif"]:
        media_type = "image/gif"
    elif file_ext in [".webp"]:
        media_type = "image/webp"
    elif file_ext in [".svg"]:
        media_type = "image/svg+xml"
    elif file_ext in [".bmp"]:
        media_type = "image/bmp"
    elif file_ext in [".ico"]:
        media_type = "image/x-icon"
    elif file_ext in [".tiff", ".tif"]:
        media_type = "image/tiff"
    elif file_ext in [".avif"]:
        media_type = "image/avif"
    # 3D file types
    elif file_ext in [".stl"]:
        media_type = "model/stl"
    elif file_ext in [".obj"]:
        media_type = "model/obj"
    elif file_ext in [".gltf"]:
        media_type = "model/gltf+json"
    elif file_ext in [".glb"]:
        media_type = "model/gltf-binary"
    elif file_ext in [".fbx"]:
        media_type = "application/octet-stream"
    elif file_ext in [".dae"]:
        media_type = "model/vnd.collada+xml"
    elif file_ext in [".3ds"]:
        media_type = "application/x-3ds"
    elif file_ext in [".3mf"]:
        media_type = "model/3mf"
    elif file_ext in [".ply"]:
        media_type = "application/ply"
    elif file_ext in [".off"]:
        media_type = "text/plain"
    elif file_ext in [".xyz"]:
        media_type = "text/plain"
    elif file_ext in [".pcd"]:
        media_type = "application/octet-stream"
    elif file_ext in [".vrml", ".wrl"]:
        media_type = "model/vrml"
    elif file_ext in [".x3d"]:
        media_type = "model/x3d+xml"
    elif file_ext in [".step", ".stp", ".iges", ".igs"]:
        media_type = "application/octet-stream"
    elif file_ext in [".dwg", ".dxf"]:
        media_type = "application/octet-stream"
    elif file_ext in [".sldprt", ".sldasm", ".slddrw"]:
        media_type = "application/octet-stream"
    elif file_ext in [".ipt", ".iam", ".idw"]:
        media_type = "application/octet-stream"
    elif file_ext in [".prt", ".asm", ".drw"]:
        media_type = "application/octet-stream"
    elif file_ext in [".catpart", ".catproduct", ".catdrawing"]:
        media_type = "application/octet-stream"
    elif file_ext in [".f3d", ".f3z"]:
        media_type = "application/octet-stream"
    elif file_ext in [".skp"]:
        media_type = "application/vnd.sketchup.skp"
    elif file_ext in [".blend"]:
        media_type = "application/x-blender"
    elif file_ext in [".max"]:
        media_type = "application/octet-stream"
    elif file_ext in [".ma", ".mb"]:
        media_type = "application/octet-stream"
    elif file_ext in [".c4d"]:
        media_type = "application/octet-stream"
    elif file_ext in [".lwo", ".lws"]:
        media_type = "application/octet-stream"
    elif file_ext in [".zpr"]:
        media_type = "application/octet-stream"
    elif file_ext in [".usd", ".usda", ".usdc", ".usdz"]:
        media_type = "model/usd"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=os.path.basename(file_path)
    )


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
        await broadcast_file_update()
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
    await broadcast_file_update()
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
            message = f"Directory created: {data.path}"
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write('')
            message = f"File created: {data.path}"
        await broadcast_file_update()
        return {"message": message}
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
        await broadcast_file_update()
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
        await broadcast_file_update()
        return {"message": "Deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from datetime import datetime

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
        await broadcast_file_update()
        return {"message": "File updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/log-ai-message")
async def log_ai_message(
    message: str = Body(..., embed=True),
    sender: str = Body(..., embed=True)
):
    log_file_path = os.path.abspath("storage/WIT_LOG.md")
    timestamp = datetime.now().isoformat()
    
    if not os.path.abspath(log_file_path).startswith(os.path.abspath("storage")):
        raise HTTPException(status_code=403, detail="Forbidden: Invalid log file path.")

    try:
        with open(log_file_path, "a") as f:
            f.write(f"**[{timestamp}] {sender.upper()}:**\n{message}\n\n---\n")
        return {"message": "Message logged successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/files")
async def websocket_file_updates(websocket: WebSocket):
    """WebSocket for real-time file system updates."""
    await websocket.accept()
    active_file_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection open
    except WebSocketDisconnect:
        active_file_connections.remove(websocket)
        logger.info("File system WebSocket client disconnected")