# software/frontend/web/routers/equipment_router.py
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from software.backend.services.database_services import get_session, Equipment, User
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class EquipmentBase(BaseModel):
    name: str
    type: str
    status: str = "offline"
    extra_data: dict = {}

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentResponse(EquipmentBase):
    id: uuid.UUID
    equipment_id: str
    owner_id: uuid.UUID

    class Config:
        from_attributes = True

@router.post("/equipment", response_model=EquipmentResponse, status_code=201)
async def create_equipment(
    equipment: EquipmentCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    new_equipment = Equipment(
        equipment_id=f"EQ-{uuid.uuid4().hex[:8].upper()}",
        name=equipment.name,
        type=equipment.type,
        status=equipment.status,
        extra_data=equipment.extra_data,
        owner_id=current_user.id
    )
    db.add(new_equipment)
    await db.commit()
    await db.refresh(new_equipment)
    return new_equipment

@router.get("/equipment", response_model=List[EquipmentResponse])
async def list_equipment(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Equipment).where(Equipment.owner_id == current_user.id))
    return result.scalars().all()

@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: str,
    db: AsyncSession = Depends(get_session)
):
    result = await db.execute(select(Equipment).where(Equipment.equipment_id == equipment_id))
    equipment = result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment

@router.delete("/equipment/{equipment_id}", status_code=204)
async def delete_equipment(
    equipment_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Equipment).where(Equipment.equipment_id == equipment_id))
    equipment = result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    if equipment.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this equipment")
    
    await db.delete(equipment)
    await db.commit()
    return
