# software/frontend/web/routers/files_router.py
from typing import List
import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from software.backend.services.database_services import get_session, File as DBFile, Project

UPLOAD_DIRECTORY = "storage/uploads/projects"

# --- Pydantic Schemas for Files ---
class FileResponse(BaseModel):
    id: uuid.UUID
    filename: str
    filesize: int
    filetype: str

    class Config:
        orm_mode = True

router = APIRouter()

@router.post("/projects/{project_id}/files", response_model=FileResponse, status_code=201)
async def upload_file_for_project(
    project_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
):
    """Upload a file for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    file_location = os.path.join(UPLOAD_DIRECTORY, file.filename)
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())
    
    db_file = DBFile(
        filename=file.filename,
        filepath=file_location,
        filesize=file.size,
        filetype=file.content_type,
        project_id=project.id
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    return db_file

@router.get("/projects/{project_id}/files", response_model=List[FileResponse])
async def get_files_for_project(
    project_id: str,
    db: AsyncSession = Depends(get_session),
):
    """Get all files for a project."""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(select(DBFile).where(DBFile.project_id == project.id))
    files = result.scalars().all()
    return files

@router.delete("/files/{file_id}", status_code=204)
async def delete_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
):
    """Delete a file."""
    result = await db.execute(select(DBFile).where(DBFile.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(file.filepath)
    await db.delete(file)
    await db.commit()
    return
