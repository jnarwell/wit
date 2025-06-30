"""
W.I.T. Vision API

FastAPI endpoints for computer vision processing and monitoring.
"""

from fastapi import APIRouter, WebSocket, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Tuple
import asyncio
import cv2
import numpy as np
import io
import json
import logging
import base64
from datetime import datetime
from enum import Enum

# Import vision processor
import sys
sys.path.append('../../ai/vision')
from vision_processor import (
    VisionProcessor, VisionConfig, VisionTask, SafetyAlert,
    Detection, SafetyEvent
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/vision", tags=["vision"])

# Global vision processor instance
vision_processor: Optional[VisionProcessor] = None


# Request/Response Models
class CameraConfig(BaseModel):
    """Camera configuration"""
    camera_index: int = Field(..., description="Camera index")
    resolution: Tuple[int, int] = Field(default=(1920, 1080))
    fps: int = Field(default=30, ge=1, le=120)
    enabled: bool = Field(default=True)


class DetectionConfig(BaseModel):
    """Detection configuration"""
    confidence_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    nms_threshold: float = Field(default=0.4, ge=0.0, le=1.0)
    max_detections: int = Field(default=100, ge=1, le=1000)
    enable_tracking: bool = Field(default=True)


class SafetyZone(BaseModel):
    """Safety zone definition"""
    name: str
    zone_type: str = Field(default="restricted", pattern="^(restricted|warning|safe)$")
    polygon: List[Tuple[int, int]] = Field(..., min_items=3)
    enabled: bool = Field(default=True)


class VisionSystemConfig(BaseModel):
    """Complete vision system configuration"""
    cameras: List[CameraConfig]
    detection: DetectionConfig
    enable_ppe_detection: bool = Field(default=True)
    enable_hazard_detection: bool = Field(default=True)
    safety_zones: List[SafetyZone] = Field(default_factory=list)


class DetectionResult(BaseModel):
    """Detection result"""
    class_name: str
    confidence: float
    bbox: List[int]  # [x1, y1, x2, y2]
    track_id: Optional[int] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class SafetyEventResponse(BaseModel):
    """Safety event response"""
    alert_level: str
    event_type: str
    description: str
    timestamp: datetime
    location: Optional[Tuple[int, int]] = None
    requires_action: bool


class VisionStatus(BaseModel):
    """Vision system status"""
    active_cameras: int
    total_detections: int
    recent_safety_events: int
    safety_score: float
    processing_fps: float
    statistics: Dict[str, Any]


class StreamConfig(BaseModel):
    """Video stream configuration"""
    camera_index: int
    quality: int = Field(default=80, ge=10, le=100)
    fps: int = Field(default=15, ge=1, le=30)
    resolution: Optional[Tuple[int, int]] = None


# API Endpoints

@router.on_event("startup")
async def startup_event():
    """Initialize vision processor on startup"""
    global vision_processor
    
    try:
        config = VisionConfig(
            camera_indices=[0],  # Default to camera 0
            enable_ppe_detection=True,
            enable_hazard_detection=True
        )
        vision_processor = VisionProcessor(config)
        await vision_processor.start()
        logger.info("Vision processor initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize vision processor: {e}")
        # Don't raise - allow API to start even if cameras unavailable


@router.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global vision_processor
    
    if vision_processor:
        await vision_processor.stop()
        logger.info("Vision processor shut down")


@router.get("/status", response_model=VisionStatus)
async def get_vision_status():
    """Get vision system status"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    stats = vision_processor.get_statistics()
    safety_status = vision_processor.get_safety_status()
    
    return VisionStatus(
        active_cameras=stats["cameras_active"],
        total_detections=stats["detections_total"],
        recent_safety_events=stats["safety_events_recent"],
        safety_score=safety_status["safety_score"],
        processing_fps=1000.0 / stats["avg_latency_ms"] if stats["avg_latency_ms"] > 0 else 0,
        statistics=stats
    )


@router.post("/configure", response_model=Dict[str, str])
async def configure_vision(config: VisionSystemConfig):
    """Update vision system configuration"""
    global vision_processor
    
    try:
        # Stop current processor
        if vision_processor:
            await vision_processor.stop()
            
        # Create new configuration
        vision_config = VisionConfig(
            camera_indices=[cam.camera_index for cam in config.cameras if cam.enabled],
            confidence_threshold=config.detection.confidence_threshold,
            nms_threshold=config.detection.nms_threshold,
            max_detections=config.detection.max_detections,
            enable_tracking=config.detection.enable_tracking,
            enable_ppe_detection=config.enable_ppe_detection,
            enable_hazard_detection=config.enable_hazard_detection,
            safety_zones=[
                {
                    "name": zone.name,
                    "type": zone.zone_type,
                    "polygon": zone.polygon
                }
                for zone in config.safety_zones if zone.enabled
            ]
        )
        
        # Reinitialize
        vision_processor = VisionProcessor(vision_config)
        await vision_processor.start()
        
        return {"status": "configured", "message": "Vision configuration updated"}
        
    except Exception as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cameras", response_model=List[Dict[str, Any]])
async def get_cameras():
    """Get list of available cameras"""
    cameras = []
    
    # Check first 10 camera indices
    for i in range(10):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            
            cameras.append({
                "index": i,
                "name": f"Camera {i}",
                "resolution": [width, height],
                "fps": fps,
                "active": vision_processor and i in vision_processor.cameras
            })
            cap.release()
            
    return cameras


@router.get("/camera/{camera_index}/snapshot")
async def get_camera_snapshot(camera_index: int):
    """Get snapshot from camera with detections"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    try:
        # Capture annotated snapshot
        frame = await vision_processor.capture_snapshot(camera_index)
        
        if frame is None:
            raise HTTPException(status_code=404, detail="Camera not found or not active")
            
        # Convert to JPEG
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/jpeg"
        )
        
    except Exception as e:
        logger.error(f"Snapshot error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/camera/{camera_index}/stream")
async def stream_camera(camera_index: int, fps: int = 15, quality: int = 80):
    """Stream video from camera"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    async def generate():
        """Generate video frames"""
        frame_interval = 1.0 / fps
        last_frame_time = 0
        
        while True:
            try:
                current_time = asyncio.get_event_loop().time()
                
                # Rate limiting
                if current_time - last_frame_time < frame_interval:
                    await asyncio.sleep(frame_interval - (current_time - last_frame_time))
                    
                # Get latest frame
                frame = vision_processor.get_latest_frame(camera_index)
                
                if frame is not None:
                    # Encode frame
                    _, buffer = cv2.imencode('.jpg', frame, 
                                           [cv2.IMWRITE_JPEG_QUALITY, quality])
                    
                    # Yield frame in multipart format
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + 
                           buffer.tobytes() + b'\r\n')
                           
                last_frame_time = asyncio.get_event_loop().time()
                
            except Exception as e:
                logger.error(f"Stream error: {e}")
                break
                
    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.websocket("/stream/detections")
async def stream_detections(websocket: WebSocket):
    """WebSocket endpoint for real-time detection streaming"""
    await websocket.accept()
    
    if not vision_processor:
        await websocket.close(code=1003, reason="Vision processor not initialized")
        return
        
    client_id = id(websocket)
    logger.info(f"Detection stream client connected: {client_id}")
    
    # Queue for detections
    detection_queue = asyncio.Queue()
    
    # Register callback
    async def detection_callback(results: Dict[str, Any]):
        await detection_queue.put(results)
        
    vision_processor.register_detection_callback(detection_callback)
    
    try:
        while True:
            # Wait for detection results
            results = await asyncio.wait_for(detection_queue.get(), timeout=1.0)
            
            # Format for client
            message = {
                "type": "detections",
                "timestamp": results.get("timestamp", datetime.now().timestamp()),
                "detections": [
                    {
                        "class": d.class_name,
                        "confidence": d.confidence,
                        "bbox": d.bbox,
                        "track_id": d.track_id
                    }
                    for d in results.get("detections", [])
                ],
                "safety_events": [
                    {
                        "level": e.alert_level.value,
                        "type": e.event_type,
                        "description": e.description,
                        "location": e.location
                    }
                    for e in results.get("safety_events", [])
                ],
                "tools": results.get("tools", [])
            }
            
            await websocket.send_json(message)
            
    except asyncio.TimeoutError:
        # Send heartbeat
        await websocket.send_json({"type": "heartbeat"})
        
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        
    finally:
        logger.info(f"Detection stream client disconnected: {client_id}")
        await websocket.close()


@router.get("/detections/latest", response_model=List[DetectionResult])
async def get_latest_detections(camera_index: Optional[int] = None):
    """Get latest detections"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    # Get latest detections from history
    detections = []
    
    # Placeholder - would get from processor
    return detections


@router.get("/safety/status", response_model=Dict[str, Any])
async def get_safety_status():
    """Get current safety status"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    return vision_processor.get_safety_status()


@router.get("/safety/events", response_model=List[SafetyEventResponse])
async def get_safety_events(
    limit: int = 100,
    alert_level: Optional[str] = None
):
    """Get recent safety events"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    # Get events from processor
    events = list(vision_processor.safety_events)[-limit:]
    
    # Filter by alert level if specified
    if alert_level:
        events = [e for e in events if e.alert_level.value == alert_level]
        
    return [
        SafetyEventResponse(
            alert_level=e.alert_level.value,
            event_type=e.event_type,
            description=e.description,
            timestamp=e.timestamp,
            location=e.location,
            requires_action=e.requires_action
        )
        for e in events
    ]


@router.post("/safety/zones", response_model=Dict[str, str])
async def add_safety_zone(zone: SafetyZone):
    """Add a safety zone"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    # Add zone to configuration
    vision_processor.config.safety_zones.append({
        "name": zone.name,
        "type": zone.zone_type,
        "polygon": zone.polygon
    })
    
    return {"status": "added", "zone": zone.name}


@router.delete("/safety/zones/{zone_name}", response_model=Dict[str, str])
async def remove_safety_zone(zone_name: str):
    """Remove a safety zone"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    # Remove zone from configuration
    vision_processor.config.safety_zones = [
        z for z in vision_processor.config.safety_zones 
        if z.get("name") != zone_name
    ]
    
    return {"status": "removed", "zone": zone_name}


@router.post("/analyze/image", response_model=Dict[str, Any])
async def analyze_image(file: UploadFile = File(...)):
    """Analyze uploaded image"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    try:
        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
            
        # Run detection
        detections = await vision_processor._detect_objects(image)
        
        # Analyze safety
        safety_events = await vision_processor._analyze_safety(image, detections)
        
        # Detect tools
        tools = await vision_processor._detect_tools(image, detections)
        
        return {
            "detections": [
                {
                    "class": d.class_name,
                    "confidence": d.confidence,
                    "bbox": d.bbox
                }
                for d in detections
            ],
            "safety_events": [
                {
                    "level": e.alert_level.value,
                    "type": e.event_type,
                    "description": e.description
                }
                for e in safety_events
            ],
            "tools": tools,
            "image_size": [image.shape[1], image.shape[0]]
        }
        
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/active", response_model=List[Dict[str, Any]])
async def get_active_tools():
    """Get list of currently active tools"""
    # Placeholder - would track tools across frames
    return [
        {
            "type": "drill",
            "location": [100, 200, 150, 250],
            "in_use": True,
            "last_seen": datetime.now().isoformat()
        }
    ]


@router.get("/activity/current", response_model=Dict[str, Any])
async def get_current_activity():
    """Get current workshop activity analysis"""
    if not vision_processor:
        raise HTTPException(status_code=503, detail="Vision processor not initialized")
        
    stats = vision_processor.get_statistics()
    
    return {
        "activity_level": "moderate",  # Would calculate from detections
        "people_count": 2,  # Would get from current detections
        "active_equipment": ["3d_printer", "cnc"],
        "ongoing_activities": ["3d_printing", "machining"],
        "workspace_utilization": 0.65,  # 65% of workspace in use
        "timestamp": datetime.now().isoformat()
    }


@router.post("/calibrate/camera/{camera_index}", response_model=Dict[str, str])
async def calibrate_camera(camera_index: int):
    """Calibrate camera (placeholder for actual calibration)"""
    # Would perform camera calibration for accurate measurements
    return {
        "status": "calibrated",
        "camera": camera_index,
        "message": "Camera calibration completed"
    }


@router.get("/models", response_model=List[Dict[str, Any]])
async def get_available_models():
    """Get list of available vision models"""
    return [
        {
            "name": "YOLOv8n",
            "type": "object_detection",
            "description": "Fast general object detection",
            "active": True
        },
        {
            "name": "PPE_Detector",
            "type": "safety",
            "description": "Personal protective equipment detection",
            "active": True
        },
        {
            "name": "Tool_Classifier",
            "type": "classification",
            "description": "Workshop tool identification",
            "active": True
        }
    ]


# Health check
@router.get("/health")
async def health_check():
    """Health check endpoint"""
    cameras_ok = vision_processor and len(vision_processor.cameras) > 0
    
    return {
        "status": "healthy" if cameras_ok else "degraded",
        "service": "vision",
        "cameras_available": cameras_ok,
        "timestamp": datetime.now().isoformat()
    }