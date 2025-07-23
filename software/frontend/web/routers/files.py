"""
W.I.T. Files API Router

File: software/backend/routers/files.py

Project file management endpoints
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from uuid import UUID
import os
import aiofiles
import mimetypes
from pathlib import Path

from software.backend.services.database_services import get_session
from software.backend.models.database_models import Project, User, ProjectFile, FileVersion
from software.backend.auth.dependencies import get_current_user
from software.backend.core.config import settings
from software.backend.schemas.file_schemas import (
    FileResponse as FileResponseSchema,
    FileVersionResponse,
    FileMoveRequest,
    FileUpdateRequest,
    FileShareRequest
)

router = APIRouter(prefix="/api/v1/projects/{project_id}/files", tags=["files"])

# Ensure upload directory exists
UPLOAD_DIR = Path(settings.UPLOAD_PATH) / "projects"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_file_path(project_id: str, file_id: str, filename: str) -> Path:
    """Generate file path for storage"""
    return UPLOAD_DIR / project_id / file_id / filename


async def save_uploaded_file(upload_file: UploadFile, destination: Path) -> Dict[str, Any]:
    """Save uploaded file and return metadata"""
    destination.parent.mkdir(parents=True, exist_ok=True)
    
    # Save file
    async with aiofiles.open(destination, 'wb') as f:
        content = await upload_file.read()
        await f.write(content)
    
    # Get file stats
    file_stats = os.stat(destination)
    
    return {
        "size": file_stats.st_size,
        "mime_type": mimetypes.guess_type(str(destination))[0] or "application/octet-stream"
    }


@router.get("", response_model=List[FileResponseSchema])
async def get_project_files(
    project_id: str,
    folder: Optional[str] = None,
    file_type: Optional[str] = None,
    search: Optional[str] = None,
    include_versions: bool = False,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all files for a project"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Build query
    query = select(ProjectFile).where(ProjectFile.project_id == project.id)
    
    # Apply filters
    if folder is not None:
        query = query.where(ProjectFile.folder == folder)
    if file_type:
        query = query.where(ProjectFile.file_type == file_type)
    if search:
        query = query.where(
            or_(
                ProjectFile.name.ilike(f"%{search}%"),
                ProjectFile.description.ilike(f"%{search}%")
            )
        )
    
    if include_versions:
        query = query.options(selectinload(ProjectFile.versions))
    
    query = query.order_by(ProjectFile.folder, ProjectFile.name)
    
    result = await db.execute(query)
    files = result.scalars().all()
    
    return files


@router.post("", response_model=FileResponseSchema)
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    folder: str = Form("/"),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated tags
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload a file to project"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check file size
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    # Create file record
    project_file = ProjectFile(
        file_id=f"FILE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        project_id=project.id,
        name=file.filename,
        folder=folder,
        description=description,
        uploaded_by=current_user.id,
        tags=tags.split(",") if tags else [],
        extra_data={}
    )
    
    # Save file
    file_path = get_file_path(project_id, project_file.file_id, file.filename)
    file_metadata = await save_uploaded_file(file, file_path)
    
    # Update file record with metadata
    project_file.size = file_metadata["size"]
    project_file.mime_type = file_metadata["mime_type"]
    project_file.file_type = file_metadata["mime_type"].split("/")[0]  # image, video, etc.
    project_file.storage_path = str(file_path.relative_to(UPLOAD_DIR))
    
    # Create initial version
    version = FileVersion(
        file_id=project_file.id,
        version_number=1,
        size=project_file.size,
        uploaded_by=current_user.id,
        storage_path=project_file.storage_path,
        changes="Initial upload"
    )
    
    db.add(project_file)
    db.add(version)
    await db.commit()
    await db.refresh(project_file)
    
    return project_file


@router.get("/{file_id}", response_model=FileResponseSchema)
async def get_file_info(
    project_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get file information"""
    
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    ).options(selectinload(ProjectFile.versions))
    
    result = await db.execute(query)
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return file


@router.get("/{file_id}/download")
async def download_file(
    project_id: str,
    file_id: str,
    version: Optional[int] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Download a file"""
    
    # Get file info
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    )
    
    result = await db.execute(query)
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get specific version if requested
    if version:
        version_query = select(FileVersion).where(
            and_(
                FileVersion.file_id == file.id,
                FileVersion.version_number == version
            )
        )
        version_result = await db.execute(version_query)
        file_version = version_result.scalar_one_or_none()
        
        if not file_version:
            raise HTTPException(status_code=404, detail="Version not found")
        
        storage_path = file_version.storage_path
    else:
        storage_path = file.storage_path
    
    # Get file path
    file_path = UPLOAD_DIR / storage_path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Return file
    return FileResponse(
        path=file_path,
        filename=file.name,
        media_type=file.mime_type
    )


@router.put("/{file_id}", response_model=FileResponseSchema)
async def update_file_metadata(
    project_id: str,
    file_id: str,
    update_data: FileUpdateRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update file metadata"""
    
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    )
    
    result = await db.execute(query)
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Update metadata
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(file, field, value)
    
    file.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(file)
    
    return file


@router.post("/{file_id}/versions", response_model=FileVersionResponse)
async def upload_new_version(
    project_id: str,
    file_id: str,
    file: UploadFile = File(...),
    changes: str = Form(...),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload a new version of existing file"""
    
    # Get original file
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    )
    
    result = await db.execute(query)
    project_file = result.scalar_one_or_none()
    
    if not project_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get latest version number
    version_query = select(func.max(FileVersion.version_number)).where(
        FileVersion.file_id == project_file.id
    )
    version_result = await db.execute(version_query)
    latest_version = version_result.scalar() or 0
    
    # Save new version
    new_version_num = latest_version + 1
    file_path = get_file_path(
        project_id, 
        project_file.file_id, 
        f"v{new_version_num}_{file.filename}"
    )
    file_metadata = await save_uploaded_file(file, file_path)
    
    # Create version record
    version = FileVersion(
        file_id=project_file.id,
        version_number=new_version_num,
        size=file_metadata["size"],
        uploaded_by=current_user.id,
        storage_path=str(file_path.relative_to(UPLOAD_DIR)),
        changes=changes
    )
    
    # Update main file record
    project_file.size = file_metadata["size"]
    project_file.storage_path = version.storage_path
    project_file.updated_at = datetime.utcnow()
    
    db.add(version)
    await db.commit()
    await db.refresh(version)
    
    return version


@router.delete("/{file_id}")
async def delete_file(
    project_id: str,
    file_id: str,
    permanent: bool = False,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a file (soft delete by default)"""
    
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    )
    
    result = await db.execute(query)
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if permanent:
        # Delete from disk
        file_path = UPLOAD_DIR / file.storage_path
        if file_path.exists():
            os.remove(file_path)
        
        # Delete from database
        await db.delete(file)
    else:
        # Soft delete
        file.deleted_at = datetime.utcnow()
        file.deleted_by = current_user.id
    
    await db.commit()
    
    return {"message": "File deleted successfully"}


@router.post("/{file_id}/move", response_model=FileResponseSchema)
async def move_file(
    project_id: str,
    file_id: str,
    move_request: FileMoveRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Move file to different folder"""
    
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    )
    
    result = await db.execute(query)
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    file.folder = move_request.folder
    file.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(file)
    
    return file


@router.post("/{file_id}/share")
async def share_file(
    project_id: str,
    file_id: str,
    share_request: FileShareRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Share file with users or generate public link"""
    
    # TODO: Implement file sharing functionality
    # This would generate shareable links or grant access to specific users
    
    return {
        "message": "File shared successfully",
        "share_link": f"https://wit.example.com/shared/{file_id}",
        "expires_at": share_request.expires_at
    }


@router.get("/folders/list")
async def list_folders(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all folders in project"""
    
    # Get unique folders
    query = select(ProjectFile.folder).join(Project).where(
        and_(
            Project.project_id == project_id,
            ProjectFile.deleted_at.is_(None)
        )
    ).distinct()
    
    result = await db.execute(query)
    folders = result.scalars().all()
    
    # Build folder tree
    folder_tree = {"/": {"name": "Root", "subfolders": {}}}
    
    for folder in folders:
        if folder and folder != "/":
            parts = folder.strip("/").split("/")
            current = folder_tree["/"]["subfolders"]
            
            for part in parts:
                if part not in current:
                    current[part] = {"name": part, "subfolders": {}}
                current = current[part]["subfolders"]
    
    return folder_tree


@router.get("/preview/{file_id}")
async def preview_file(
    project_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Generate file preview (for images, PDFs, etc.)"""
    
    # Get file info
    query = select(ProjectFile).where(
        and_(
            ProjectFile.file_id == file_id,
            ProjectFile.project.has(project_id=project_id)
        )
    )
    
    result = await db.execute(query)
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if file type supports preview
    if file.file_type not in ["image", "application/pdf"]:
        raise HTTPException(status_code=400, detail="File type does not support preview")
    
    # TODO: Implement preview generation
    # For images: return thumbnail
    # For PDFs: return first page as image
    
    file_path = UPLOAD_DIR / file.storage_path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # For now, return the file directly
    return FileResponse(
        path=file_path,
        media_type=file.mime_type
    )