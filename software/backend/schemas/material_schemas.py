"""Material schemas for W.I.T."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class MaterialType(str, Enum):
    FILAMENT = "filament"
    RESIN = "resin"
    WOOD = "wood"
    METAL = "metal"
    PLASTIC = "plastic"
    ELECTRONIC = "electronic"
    OTHER = "other"

class MaterialBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: MaterialType
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=20)
    location: Optional[str] = None
    properties: Optional[Dict[str, Any]] = {}

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    location: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

class MaterialResponse(MaterialBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Additional schemas for materials router

class ProjectMaterialAdd(BaseModel):
    """Add material to project"""
    material_id: int
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = None

class ProjectMaterialUpdate(BaseModel):
    """Auto-generated schema for ProjectMaterialUpdate"""
    # TODO: Add proper fields
    data: Optional[dict] = None

class ProjectMaterialResponse(BaseModel):
    """Auto-generated schema for ProjectMaterialResponse"""
    # TODO: Add proper fields
    data: Optional[dict] = None

class MaterialUsageCreate(BaseModel):
    """Auto-generated schema for MaterialUsageCreate"""
    # TODO: Add proper fields
    data: Optional[dict] = None

class MaterialUsageResponse(BaseModel):
    """Auto-generated schema for MaterialUsageResponse"""
    # TODO: Add proper fields
    data: Optional[dict] = None

class MaterialStockUpdate(BaseModel):
    """Update material stock"""
    quantity: float
    operation: str = Field(..., pattern="^(set|add|subtract)$")
    reason: Optional[str] = None

class BOMExportRequest(BaseModel):
    """Auto-generated schema for BOMExportRequest"""
    # TODO: Add proper fields
    data: Optional[dict] = None

class MaterialRequirementResponse(BaseModel):
    """Auto-generated schema for MaterialRequirementResponse"""
    # TODO: Add proper fields
    data: Optional[dict] = None
