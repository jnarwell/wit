# software/frontend/web/routers/microcontrollers_router.py
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import asyncio
import json
from datetime import datetime

from software.backend.services.database_services import get_session, User
from software.backend.models.microcontroller import (
    Microcontroller, SensorReading, DeviceLog, 
    ConnectionStatus as DBConnectionStatus
)
from software.backend.schemas.microcontroller import (
    MicrocontrollerCreate, MicrocontrollerUpdate, MicrocontrollerResponse,
    MicrocontrollerCommand, MicrocontrollerCommandResponse,
    SensorReadingCreate, SensorReadingResponse,
    DeviceLogCreate, DeviceLogResponse,
    SerialPortInfo
)
from software.frontend.web.routers.projects_router import get_current_user
from software.backend.services.microcontrollers import microcontroller_manager

router = APIRouter()


@router.get("/", response_model=List[MicrocontrollerResponse])
async def list_microcontrollers(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all microcontrollers for the current user"""
    result = await db.execute(
        select(Microcontroller).where(Microcontroller.owner_id == str(current_user.id))
    )
    return result.scalars().all()


@router.get("/ports", response_model=List[SerialPortInfo])
async def list_serial_ports():
    """List available serial ports on the system"""
    return await microcontroller_manager.list_serial_ports()


@router.post("/", response_model=MicrocontrollerResponse)
async def create_microcontroller(
    microcontroller: MicrocontrollerCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new microcontroller"""
    db_microcontroller = Microcontroller(
        **microcontroller.model_dump(),
        owner_id=str(current_user.id)
    )
    db.add(db_microcontroller)
    await db.commit()
    await db.refresh(db_microcontroller)
    
    # Try to establish initial connection
    await microcontroller_manager.connect(db_microcontroller.id)
    
    return db_microcontroller


@router.get("/{microcontroller_id}", response_model=MicrocontrollerResponse)
async def get_microcontroller(
    microcontroller_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific microcontroller"""
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    return microcontroller


@router.patch("/{microcontroller_id}", response_model=MicrocontrollerResponse)
async def update_microcontroller(
    microcontroller_id: str,
    update: MicrocontrollerUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a microcontroller"""
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    # Update fields
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(microcontroller, field, value)
    
    microcontroller.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(microcontroller)
    
    return microcontroller


@router.delete("/{microcontroller_id}")
async def delete_microcontroller(
    microcontroller_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a microcontroller"""
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    # Disconnect if connected
    await microcontroller_manager.disconnect(microcontroller_id)
    
    await db.delete(microcontroller)
    await db.commit()
    
    return {"detail": "Microcontroller deleted"}


@router.post("/{microcontroller_id}/connect")
async def connect_microcontroller(
    microcontroller_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Connect to a microcontroller"""
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    success = await microcontroller_manager.connect(microcontroller_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to connect to microcontroller")
    
    return {"detail": "Connected successfully"}


@router.post("/{microcontroller_id}/disconnect")
async def disconnect_microcontroller(
    microcontroller_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Disconnect from a microcontroller"""
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    await microcontroller_manager.disconnect(microcontroller_id)
    
    return {"detail": "Disconnected successfully"}


@router.post("/{microcontroller_id}/command", response_model=MicrocontrollerCommandResponse)
async def send_command(
    microcontroller_id: str,
    command: MicrocontrollerCommand,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Send a command to a microcontroller"""
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    response = await microcontroller_manager.send_command(
        microcontroller_id, 
        command.command, 
        command.params
    )
    
    return response


@router.get("/{microcontroller_id}/readings", response_model=List[SensorReadingResponse])
async def get_sensor_readings(
    microcontroller_id: str,
    limit: int = 100,
    sensor_type: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get sensor readings from a microcontroller"""
    # Verify ownership
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    # Build query
    query = select(SensorReading).where(
        SensorReading.microcontroller_id == microcontroller_id
    )
    
    if sensor_type:
        query = query.where(SensorReading.sensor_type == sensor_type)
    
    query = query.order_by(SensorReading.timestamp.desc()).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{microcontroller_id}/logs", response_model=List[DeviceLogResponse])
async def get_device_logs(
    microcontroller_id: str,
    limit: int = 100,
    level: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get logs from a microcontroller"""
    # Verify ownership
    result = await db.execute(
        select(Microcontroller).where(
            Microcontroller.id == microcontroller_id,
            Microcontroller.owner_id == str(current_user.id)
        )
    )
    microcontroller = result.scalar_one_or_none()
    if not microcontroller:
        raise HTTPException(status_code=404, detail="Microcontroller not found")
    
    # Build query
    query = select(DeviceLog).where(
        DeviceLog.microcontroller_id == microcontroller_id
    )
    
    if level:
        query = query.where(DeviceLog.level == level)
    
    query = query.order_by(DeviceLog.timestamp.desc()).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.websocket("/{microcontroller_id}/ws")
async def microcontroller_websocket(
    websocket: WebSocket,
    microcontroller_id: str,
    db: AsyncSession = Depends(get_session)
):
    """WebSocket connection for real-time microcontroller data"""
    await websocket.accept()
    
    try:
        # Subscribe to microcontroller events
        await microcontroller_manager.subscribe_websocket(microcontroller_id, websocket)
        
        # Keep connection alive
        while True:
            # Wait for messages from client (like commands)
            try:
                data = await websocket.receive_json()
                if data.get("type") == "command":
                    response = await microcontroller_manager.send_command(
                        microcontroller_id,
                        data.get("command"),
                        data.get("params")
                    )
                    await websocket.send_json({
                        "type": "command_response",
                        "data": response.model_dump()
                    })
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                await websocket.send_json({"type": "ping"})
                
    except WebSocketDisconnect:
        await microcontroller_manager.unsubscribe_websocket(microcontroller_id, websocket)
    except Exception as e:
        await websocket.close(code=1000, reason=str(e))
        await microcontroller_manager.unsubscribe_websocket(microcontroller_id, websocket)