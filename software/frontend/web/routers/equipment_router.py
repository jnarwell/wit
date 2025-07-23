# software/frontend/web/routers/equipment_router.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()

class Printer(BaseModel):
    id: str
    name: str
    status: str

# In-memory storage for printers for now
printers_db: List[Printer] = []

@router.get("/equipment/printers/{printer_id}", response_model=Printer)
async def get_printer(printer_id: str):
    """Get a single printer by its ID."""
    printer = next((p for p in printers_db if p.id == printer_id), None)
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    return printer