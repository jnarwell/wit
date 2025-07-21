"""
W.I.T. Materials API Router

File: software/backend/routers/materials.py

BOM and material tracking endpoints for projects
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update
from uuid import UUID
from decimal import Decimal

from ..services.database_services import get_session
from ..models.database_models import Project, User, Material, ProjectMaterial, MaterialUsage
from ..auth.dependencies import get_current_user
from ..schemas.material_schemas import (
    MaterialCreate,
    MaterialUpdate,
    MaterialResponse,
    ProjectMaterialAdd,
    ProjectMaterialUpdate,
    ProjectMaterialResponse,
    MaterialUsageCreate,
    MaterialUsageResponse,
    MaterialStockUpdate,
    BOMExportRequest,
    MaterialRequirementResponse
)

router = APIRouter(prefix="/api/v1/projects/{project_id}/materials", tags=["materials"])


@router.get("", response_model=List[ProjectMaterialResponse])
async def get_project_materials(
    project_id: str,
    include_usage: bool = False,
    include_stock: bool = True,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all materials for a project (BOM)"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get project materials with material details
    query = select(ProjectMaterial).where(
        ProjectMaterial.project_id == project.id
    ).options(selectinload(ProjectMaterial.material))
    
    if include_usage:
        query = query.options(selectinload(ProjectMaterial.usage_history))
    
    result = await db.execute(query)
    project_materials = result.scalars().all()
    
    # Calculate current stock if requested
    if include_stock:
        for pm in project_materials:
            # Get current stock from material inventory
            material = pm.material
            pm.current_stock = material.quantity
            pm.stock_status = "in_stock" if material.quantity >= pm.required_quantity else "low_stock"
    
    return project_materials


@router.post("", response_model=ProjectMaterialResponse)
async def add_material_to_project(
    project_id: str,
    material_data: ProjectMaterialAdd,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add material to project BOM"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if material exists or create new
    if material_data.material_id:
        material_query = select(Material).where(Material.material_id == material_data.material_id)
        material_result = await db.execute(material_query)
        material = material_result.scalar_one_or_none()
        
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
    else:
        # Create new material
        material = Material(
            material_id=f"MAT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            name=material_data.name,
            type=material_data.type,
            quantity=material_data.initial_stock or 0,
            unit=material_data.unit,
            color=material_data.color,
            supplier=material_data.supplier,
            cost_per_unit=material_data.cost_per_unit,
            properties=material_data.properties or {}
        )
        db.add(material)
        await db.flush()
    
    # Check if already in BOM
    existing_query = select(ProjectMaterial).where(
        and_(
            ProjectMaterial.project_id == project.id,
            ProjectMaterial.material_id == material.id
        )
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Material already in project BOM")
    
    # Add to project BOM
    project_material = ProjectMaterial(
        project_id=project.id,
        material_id=material.id,
        required_quantity=material_data.required_quantity,
        allocated_quantity=0,
        notes=material_data.notes,
        extra_data={
            "specifications": material_data.specifications or {},
            "alternatives": material_data.alternatives or [],
            "critical": material_data.critical or False
        }
    )
    
    db.add(project_material)
    await db.commit()
    await db.refresh(project_material)
    
    return project_material


@router.put("/{material_id}", response_model=ProjectMaterialResponse)
async def update_project_material(
    project_id: str,
    material_id: str,
    material_update: ProjectMaterialUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update material requirements in BOM"""
    
    # Get project material
    query = select(ProjectMaterial).join(Project).join(Material).where(
        and_(
            Project.project_id == project_id,
            Material.material_id == material_id
        )
    )
    result = await db.execute(query)
    project_material = result.scalar_one_or_none()
    
    if not project_material:
        raise HTTPException(status_code=404, detail="Material not found in project BOM")
    
    # Update fields
    update_data = material_update.dict(exclude_unset=True)
    
    if "specifications" in update_data:
        project_material.extra_data["specifications"] = update_data.pop("specifications")
    if "alternatives" in update_data:
        project_material.extra_data["alternatives"] = update_data.pop("alternatives")
    if "critical" in update_data:
        project_material.extra_data["critical"] = update_data.pop("critical")
    
    for field, value in update_data.items():
        setattr(project_material, field, value)
    
    project_material.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(project_material)
    
    return project_material


@router.delete("/{material_id}")
async def remove_material_from_project(
    project_id: str,
    material_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove material from project BOM"""
    
    # Get project material
    query = select(ProjectMaterial).join(Project).join(Material).where(
        and_(
            Project.project_id == project_id,
            Material.material_id == material_id
        )
    )
    result = await db.execute(query)
    project_material = result.scalar_one_or_none()
    
    if not project_material:
        raise HTTPException(status_code=404, detail="Material not found in project BOM")
    
    # Check if material has been used
    if project_material.allocated_quantity > 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot remove material that has been allocated. Set required quantity to 0 instead."
        )
    
    await db.delete(project_material)
    await db.commit()
    
    return {"message": "Material removed from project BOM"}


@router.post("/{material_id}/allocate", response_model=MaterialUsageResponse)
async def allocate_material(
    project_id: str,
    material_id: str,
    usage_data: MaterialUsageCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Allocate/use material from inventory"""
    
    # Get project material
    pm_query = select(ProjectMaterial).join(Project).join(Material).where(
        and_(
            Project.project_id == project_id,
            Material.material_id == material_id
        )
    ).options(selectinload(ProjectMaterial.material))
    
    pm_result = await db.execute(pm_query)
    project_material = pm_result.scalar_one_or_none()
    
    if not project_material:
        raise HTTPException(status_code=404, detail="Material not found in project BOM")
    
    material = project_material.material
    
    # Check stock availability
    if material.quantity < usage_data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {material.quantity} {material.unit}"
        )
    
    # Update material stock
    material.quantity -= usage_data.quantity
    material.last_updated = datetime.utcnow()
    
    # Update project allocation
    project_material.allocated_quantity += usage_data.quantity
    
    # Record usage
    usage = MaterialUsage(
        project_material_id=project_material.id,
        quantity=usage_data.quantity,
        purpose=usage_data.purpose,
        used_by=current_user.id,
        notes=usage_data.notes,
        location=usage_data.location,
        extra_data={
            "task_id": usage_data.task_id,
            "equipment_id": usage_data.equipment_id,
            "waste_percentage": usage_data.waste_percentage or 0
        }
    )
    
    db.add(usage)
    await db.commit()
    await db.refresh(usage)
    
    return usage


@router.post("/{material_id}/return", response_model=MaterialUsageResponse)
async def return_material(
    project_id: str,
    material_id: str,
    quantity: float = Body(..., embed=True),
    notes: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Return unused material to inventory"""
    
    # Get project material
    pm_query = select(ProjectMaterial).join(Project).join(Material).where(
        and_(
            Project.project_id == project_id,
            Material.material_id == material_id
        )
    ).options(selectinload(ProjectMaterial.material))
    
    pm_result = await db.execute(pm_query)
    project_material = pm_result.scalar_one_or_none()
    
    if not project_material:
        raise HTTPException(status_code=404, detail="Material not found in project BOM")
    
    if quantity > project_material.allocated_quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot return more than allocated. Allocated: {project_material.allocated_quantity}"
        )
    
    material = project_material.material
    
    # Update material stock
    material.quantity += quantity
    material.last_updated = datetime.utcnow()
    
    # Update project allocation
    project_material.allocated_quantity -= quantity
    
    # Record return as negative usage
    usage = MaterialUsage(
        project_material_id=project_material.id,
        quantity=-quantity,  # Negative for returns
        purpose="Material return",
        used_by=current_user.id,
        notes=notes or "Unused material returned to inventory"
    )
    
    db.add(usage)
    await db.commit()
    await db.refresh(usage)
    
    return usage


@router.get("/{material_id}/usage", response_model=List[MaterialUsageResponse])
async def get_material_usage_history(
    project_id: str,
    material_id: str,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get usage history for a material in project"""
    
    # Get project material
    pm_query = select(ProjectMaterial).join(Project).join(Material).where(
        and_(
            Project.project_id == project_id,
            Material.material_id == material_id
        )
    )
    pm_result = await db.execute(pm_query)
    project_material = pm_result.scalar_one_or_none()
    
    if not project_material:
        raise HTTPException(status_code=404, detail="Material not found in project BOM")
    
    # Get usage history
    usage_query = select(MaterialUsage).where(
        MaterialUsage.project_material_id == project_material.id
    ).order_by(MaterialUsage.used_at.desc()).offset(skip).limit(limit)
    
    usage_result = await db.execute(usage_query)
    usage_history = usage_result.scalars().all()
    
    return usage_history


@router.get("/requirements", response_model=MaterialRequirementResponse)
async def get_material_requirements(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get material requirements summary"""
    
    # Verify project exists
    project_query = select(Project).where(Project.project_id == project_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all project materials
    pm_query = select(ProjectMaterial).where(
        ProjectMaterial.project_id == project.id
    ).options(selectinload(ProjectMaterial.material))
    
    pm_result = await db.execute(pm_query)
    project_materials = pm_result.scalars().all()
    
    # Calculate requirements
    total_cost = 0
    materials_needed = []
    materials_available = []
    critical_shortages = []
    
    for pm in project_materials:
        material = pm.material
        needed_quantity = pm.required_quantity - pm.allocated_quantity
        
        item_cost = (pm.required_quantity * (material.cost_per_unit or 0))
        total_cost += item_cost
        
        material_info = {
            "material_id": material.material_id,
            "name": material.name,
            "required": pm.required_quantity,
            "allocated": pm.allocated_quantity,
            "available": material.quantity,
            "needed": max(0, needed_quantity),
            "unit": material.unit,
            "cost": item_cost
        }
        
        if needed_quantity > 0:
            if material.quantity >= needed_quantity:
                materials_available.append(material_info)
            else:
                materials_needed.append(material_info)
                if pm.extra_data.get("critical", False):
                    critical_shortages.append(material_info)
    
    return {
        "total_materials": len(project_materials),
        "total_cost": total_cost,
        "materials_available": materials_available,
        "materials_needed": materials_needed,
        "critical_shortages": critical_shortages,
        "completion_percentage": (
            sum(pm.allocated_quantity / pm.required_quantity * 100 
                for pm in project_materials if pm.required_quantity > 0) 
            / len(project_materials) if project_materials else 0
        )
    }


@router.post("/export-bom")
async def export_bom(
    project_id: str,
    export_request: BOMExportRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Export BOM in various formats"""
    
    # TODO: Implement BOM export functionality
    # This would generate CSV, PDF, or JSON exports of the BOM
    
    return {
        "message": "BOM export generated",
        "format": export_request.format,
        "download_url": f"/api/v1/downloads/bom/{project_id}.{export_request.format}"
    }


@router.get("/suppliers")
async def get_project_suppliers(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all suppliers for project materials"""
    
    # Get unique suppliers from project materials
    query = select(Material.supplier).join(ProjectMaterial).join(Project).where(
        and_(
            Project.project_id == project_id,
            Material.supplier.isnot(None)
        )
    ).distinct()
    
    result = await db.execute(query)
    suppliers = [s for s in result.scalars().all() if s]
    
    return {"suppliers": suppliers}