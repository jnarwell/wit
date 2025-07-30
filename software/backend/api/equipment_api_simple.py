"""
Simple Equipment API Router

Temporary simplified version without frontend dependencies
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any
from services.auth_services import get_current_user

router = APIRouter(prefix="/api/v1/equipment", tags=["equipment"])

@router.get("/")
async def list_equipment(current_user: dict = Depends(get_current_user)):
    """List all equipment"""
    return {"equipment": []}

@router.get("/printers")
async def list_printers(current_user: dict = Depends(get_current_user)):
    """List all printers"""
    return {"printers": []}

@router.get("/cnc")
async def list_cnc_machines(current_user: dict = Depends(get_current_user)):
    """List all CNC machines"""
    return {"cnc_machines": []}