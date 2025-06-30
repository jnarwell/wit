"""
W.I.T. Vision Processing Module

Real-time computer vision for workshop monitoring, safety detection,
tool recognition, and visual assistance.
"""

import asyncio
import numpy as np
import cv2
import torch
import logging
from typing import Optional, Dict, Any, List, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime
from collections import deque
from enum import Enum
import json
import onnxruntime as ort
from ultralytics import YOLO
import time

# Configure logging
logger = logging.getLogger(__name__)


class VisionTask(Enum):
    """Vision processing tasks"""
    OBJECT_DETECTION = "object_detection"
    SAFETY_MONITORING = "safety_monitoring"
    TOOL_TRACKING = "tool_tracking"
    GESTURE_RECOGNITION = "gesture_recognition"
    MEASUREMENT = "measurement"
    OCR = "ocr"
    QUALITY_INSPECTION = "quality_inspection"


class SafetyAlert(Enum):
    """Safety alert levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class Detection:
    """Object detection result"""
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    track_id: Optional[int] = None
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SafetyEvent:
    """Safety-related event"""
    alert_level: SafetyAlert
    event_type: str
    description: str
    location: Optional[Tuple[int, int]] = None
    timestamp: datetime = field(default_factory=datetime.now)
    image: Optional[np.ndarray] = None
    requires_action: bool = False


@dataclass
class VisionConfig:
    """Vision processing configuration"""
    # Model settings
    detection_model: str = "yolov8n.pt"  # YOLOv8 nano for speed
    safety_model: str = "models/safety_detection.onnx"
    use_gpu: bool = torch.cuda.is_available()
    use_npu: bool = True  # Use Hailo NPU if available
    
    # Camera settings
    camera_indices: List[int] = field(default_factory=lambda: [0])
    resolution: Tuple[int, int] = (1920, 1080)
    fps: int = 30
    
    # Detection settings
    confidence_threshold: float = 0.5
    nms_threshold: float = 0.4
    max_detections: int = 100
    
    # Safety settings
    enable_ppe_detection: bool = True
    enable_hazard_detection: bool = True
    enable_ergonomics: bool = True
    safety_zones: List[Dict[str, Any]] = field(default_factory=list)
    
    # Performance settings
    frame_skip: int = 1  # Process every N frames
    max_processing_fps: int = 10
    enable_tracking: bool = True
    tracking_max_age: int = 30


class VisionProcessor:
    """Main vision processing class"""
    
    def __init__(self, config: VisionConfig):
        self.config = config
        self.is_running = False
        
        # Initialize models
        self._init_models()
        
        # Camera management
        self.cameras: Dict[int, cv2.VideoCapture] = {}
        self.camera_threads: Dict[int, asyncio.Task] = {}
        
        # Frame buffers
        self.frame_buffers: Dict[int, deque] = {}
        self.latest_frames: Dict[int, np.ndarray] = {}
        
        # Detection tracking
        self.trackers: Dict[int, Any] = {}  # Per-camera trackers
        self.detection_history: deque = deque(maxlen=1000)
        
        # Safety monitoring
        self.safety_events: deque = deque(maxlen=100)
        self.ppe_status: Dict[str, bool] = {}
        
        # Callbacks
        self.detection_callbacks: List[Callable] = []
        self.safety_callbacks: List[Callable] = []
        
        # Statistics
        self.stats = {
            "frames_processed": 0,
            "detections_total": 0,
            "safety_events": 0,
            "avg_fps": 0.0,
            "avg_latency_ms": 0.0
        }
        
        # Processing queues
        self.frame_queue = asyncio.Queue(maxsize=30)
        self.result_queue = asyncio.Queue()
        
    def _init_models(self):
        """Initialize vision models"""
        logger.info("Initializing vision models...")
        
        # Object detection model
        self.detector = YOLO(self.config.detection_model)
        if self.config.use_gpu:
            self.detector.to('cuda')
            
        # Safety detection model (custom trained)
        self.safety_model = self._load_safety_model()
        
        # OCR model (for reading displays, labels)
        # self.ocr_model = self._load_ocr_model()
        
        # Tool recognition model
        self.tool_classifier = self._load_tool_classifier()
        
        logger.info("Vision models initialized")
        
    def _load_safety_model(self) -> Optional[ort.InferenceSession]:
        """Load custom safety detection model"""
        try:
            providers = ['CPUExecutionProvider']
            if self.config.use_npu:
                providers.insert(0, 'HailoExecutionProvider')
            elif self.config.use_gpu:
                providers.insert(0, 'CUDAExecutionProvider')
                
            # Placeholder - would load actual model
            # return ort.InferenceSession(self.config.safety_model, providers=providers)
            logger.info("Safety model loaded (placeholder)")
            return None
        except Exception as e:
            logger.warning(f"Could not load safety model: {e}")
            return None
            
    def _load_tool_classifier(self) -> Optional[Any]:
        """Load tool classification model"""
        # Placeholder for tool recognition model
        logger.info("Tool classifier loaded (placeholder)")
        return None
        
    async def start(self):
        """Start vision processing"""
        logger.info("Starting vision processor")
        self.is_running = True
        
        # Initialize cameras
        for cam_idx in self.config.camera_indices:
            await self._init_camera(cam_idx)
            
        # Start processing tasks
        self.processing_task = asyncio.create_task(self._processing_loop())
        self.analysis_task = asyncio.create_task(self._analysis_loop())
        
    async def stop(self):
        """Stop vision processing"""
        logger.info("Stopping vision processor")
        self.is_running = False
        
        # Stop camera threads
        for task in self.camera_threads.values():
            task.cancel()
            
        # Release cameras
        for cam in self.cameras.values():
            cam.release()
            
        # Cancel processing tasks
        if hasattr(self, 'processing_task'):
            self.processing_task.cancel()
        if hasattr(self, 'analysis_task'):
            self.analysis_task.cancel()
            
    async def _init_camera(self, camera_index: int):
        """Initialize camera"""
        try:
            cap = cv2.VideoCapture(camera_index)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.resolution[0])
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.resolution[1])
            cap.set(cv2.CAP_PROP_FPS, self.config.fps)
            
            if cap.isOpened():
                self.cameras[camera_index] = cap
                self.frame_buffers[camera_index] = deque(maxlen=30)
                
                # Start capture thread
                self.camera_threads[camera_index] = asyncio.create_task(
                    self._camera_capture_loop(camera_index)
                )
                logger.info(f"Camera {camera_index} initialized")
            else:
                logger.error(f"Failed to open camera {camera_index}")
                
        except Exception as e:
            logger.error(f"Error initializing camera {camera_index}: {e}")
            
    async def _camera_capture_loop(self, camera_index: int):
        """Continuous camera capture"""
        cap = self.cameras[camera_index]
        frame_count = 0
        
        while self.is_running:
            try:
                ret, frame = cap.read()
                if ret:
                    frame_count += 1
                    
                    # Skip frames based on config
                    if frame_count % self.config.frame_skip == 0:
                        # Add to processing queue
                        if not self.frame_queue.full():
                            await self.frame_queue.put((camera_index, frame, time.time()))
                            
                        # Update latest frame
                        self.latest_frames[camera_index] = frame
                        
                await asyncio.sleep(0.001)  # Small delay
                
            except Exception as e:
                logger.error(f"Camera {camera_index} capture error: {e}")
                await asyncio.sleep(1.0)
                
    async def _processing_loop(self):
        """Main processing loop"""
        while self.is_running:
            try:
                # Get frame from queue
                camera_idx, frame, timestamp = await asyncio.wait_for(
                    self.frame_queue.get(), 
                    timeout=1.0
                )
                
                # Process frame
                start_time = time.time()
                results = await self._process_frame(camera_idx, frame, timestamp)
                latency = (time.time() - start_time) * 1000
                
                # Update statistics
                self.stats["frames_processed"] += 1
                self.stats["avg_latency_ms"] = (
                    (self.stats["avg_latency_ms"] * (self.stats["frames_processed"] - 1) + latency) /
                    self.stats["frames_processed"]
                )
                
                # Queue results for analysis
                await self.result_queue.put((camera_idx, results, frame, timestamp))
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Processing error: {e}")
                
    async def _process_frame(self, camera_idx: int, frame: np.ndarray, 
                           timestamp: float) -> Dict[str, Any]:
        """Process single frame"""
        results = {
            "detections": [],
            "safety_events": [],
            "measurements": {},
            "timestamp": timestamp
        }
        
        # Run object detection
        detections = await self._detect_objects(frame)
        results["detections"] = detections
        
        # Update tracking
        if self.config.enable_tracking:
            self._update_tracking(camera_idx, detections, frame)
            
        # Safety analysis
        safety_events = await self._analyze_safety(frame, detections)
        results["safety_events"] = safety_events
        
        # Tool detection
        tools = await self._detect_tools(frame, detections)
        results["tools"] = tools
        
        # Update statistics
        self.stats["detections_total"] += len(detections)
        
        return results
        
    async def _detect_objects(self, frame: np.ndarray) -> List[Detection]:
        """Run object detection on frame"""
        try:
            # Run YOLO detection
            results = self.detector(frame, conf=self.config.confidence_threshold)
            
            detections = []
            for r in results:
                boxes = r.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = box.conf[0].item()
                        cls = int(box.cls[0].item())
                        
                        detection = Detection(
                            class_name=self.detector.names[cls],
                            confidence=conf,
                            bbox=(int(x1), int(y1), int(x2), int(y2))
                        )
                        detections.append(detection)
                        
            return detections
            
        except Exception as e:
            logger.error(f"Object detection error: {e}")
            return []
            
    async def _analyze_safety(self, frame: np.ndarray, 
                            detections: List[Detection]) -> List[SafetyEvent]:
        """Analyze frame for safety issues"""
        safety_events = []
        
        # Check for PPE (Personal Protective Equipment)
        if self.config.enable_ppe_detection:
            ppe_events = self._check_ppe(frame, detections)
            safety_events.extend(ppe_events)
            
        # Check for hazards
        if self.config.enable_hazard_detection:
            hazard_events = self._check_hazards(frame, detections)
            safety_events.extend(hazard_events)
            
        # Check safety zones
        zone_events = self._check_safety_zones(detections)
        safety_events.extend(zone_events)
        
        # Update safety event history
        for event in safety_events:
            self.safety_events.append(event)
            self.stats["safety_events"] += 1
            
            # Trigger callbacks for critical events
            if event.alert_level in [SafetyAlert.CRITICAL, SafetyAlert.EMERGENCY]:
                await self._trigger_safety_callbacks(event)
                
        return safety_events
        
    def _check_ppe(self, frame: np.ndarray, 
                   detections: List[Detection]) -> List[SafetyEvent]:
        """Check for proper PPE usage"""
        events = []
        
        # Look for people in detections
        people = [d for d in detections if d.class_name == "person"]
        
        for person in people:
            x1, y1, x2, y2 = person.bbox
            person_roi = frame[y1:y2, x1:x2]
            
            # Check for safety equipment (simplified)
            # In reality, would use specialized PPE detection model
            
            # Check for safety glasses
            has_glasses = self._detect_safety_glasses(person_roi)
            if not has_glasses:
                events.append(SafetyEvent(
                    alert_level=SafetyAlert.WARNING,
                    event_type="missing_ppe",
                    description="Person without safety glasses detected",
                    location=((x1 + x2) // 2, (y1 + y2) // 2),
                    requires_action=True
                ))
                
            # Check for gloves when near equipment
            near_equipment = self._check_proximity_to_equipment(person.bbox, detections)
            if near_equipment and not self._detect_gloves(person_roi):
                events.append(SafetyEvent(
                    alert_level=SafetyAlert.WARNING,
                    event_type="missing_ppe",
                    description="Person near equipment without gloves",
                    location=((x1 + x2) // 2, (y1 + y2) // 2),
                    requires_action=True
                ))
                
        return events
        
    def _check_hazards(self, frame: np.ndarray, 
                      detections: List[Detection]) -> List[SafetyEvent]:
        """Check for workplace hazards"""
        events = []
        
        # Check for fire/smoke (simplified - would use specialized model)
        if self._detect_smoke(frame):
            events.append(SafetyEvent(
                alert_level=SafetyAlert.EMERGENCY,
                event_type="fire_hazard",
                description="Smoke or fire detected",
                requires_action=True,
                image=frame
            ))
            
        # Check for spills or obstacles
        floor_hazards = [d for d in detections if d.class_name in ["spill", "obstacle"]]
        for hazard in floor_hazards:
            events.append(SafetyEvent(
                alert_level=SafetyAlert.WARNING,
                event_type="floor_hazard",
                description=f"{hazard.class_name} detected on floor",
                location=(hazard.bbox[0], hazard.bbox[1]),
                requires_action=True
            ))
            
        return events
        
    def _check_safety_zones(self, detections: List[Detection]) -> List[SafetyEvent]:
        """Check if objects/people are in restricted zones"""
        events = []
        
        for zone in self.config.safety_zones:
            zone_poly = zone.get("polygon", [])
            zone_type = zone.get("type", "restricted")
            
            for detection in detections:
                if self._is_in_zone(detection.bbox, zone_poly):
                    if zone_type == "restricted" and detection.class_name == "person":
                        events.append(SafetyEvent(
                            alert_level=SafetyAlert.CRITICAL,
                            event_type="zone_violation",
                            description=f"Person in restricted zone: {zone.get('name', 'Unknown')}",
                            location=(detection.bbox[0], detection.bbox[1]),
                            requires_action=True
                        ))
                        
        return events
        
    async def _detect_tools(self, frame: np.ndarray, 
                          detections: List[Detection]) -> List[Dict[str, Any]]:
        """Detect and classify tools"""
        tools = []
        
        # Filter potential tool detections
        tool_classes = ["tool", "hammer", "screwdriver", "wrench", "drill", "saw"]
        tool_detections = [d for d in detections if any(tc in d.class_name.lower() for tc in tool_classes)]
        
        for detection in tool_detections:
            x1, y1, x2, y2 = detection.bbox
            tool_roi = frame[y1:y2, x1:x2]
            
            # Classify tool type (placeholder)
            tool_info = {
                "type": detection.class_name,
                "location": detection.bbox,
                "confidence": detection.confidence,
                "in_use": self._is_tool_in_use(tool_roi),
                "condition": "good"  # Would analyze tool condition
            }
            tools.append(tool_info)
            
        return tools
        
    def _update_tracking(self, camera_idx: int, detections: List[Detection], 
                        frame: np.ndarray):
        """Update object tracking"""
        # Simplified tracking - in production would use DeepSORT or similar
        if camera_idx not in self.trackers:
            self.trackers[camera_idx] = {}
            
        tracker = self.trackers[camera_idx]
        
        # Simple IoU-based tracking
        for detection in detections:
            best_iou = 0
            best_track_id = None
            
            for track_id, track_info in tracker.items():
                iou = self._calculate_iou(detection.bbox, track_info["bbox"])
                if iou > best_iou and iou > 0.3:
                    best_iou = iou
                    best_track_id = track_id
                    
            if best_track_id:
                detection.track_id = best_track_id
                tracker[best_track_id]["bbox"] = detection.bbox
                tracker[best_track_id]["age"] = 0
            else:
                # New track
                new_id = max(tracker.keys(), default=0) + 1
                detection.track_id = new_id
                tracker[new_id] = {
                    "bbox": detection.bbox,
                    "age": 0,
                    "class": detection.class_name
                }
                
        # Age out old tracks
        to_remove = []
        for track_id, track_info in tracker.items():
            track_info["age"] += 1
            if track_info["age"] > self.config.tracking_max_age:
                to_remove.append(track_id)
                
        for track_id in to_remove:
            del tracker[track_id]
            
    async def _analysis_loop(self):
        """Background analysis loop"""
        while self.is_running:
            try:
                # Get results from queue
                camera_idx, results, frame, timestamp = await asyncio.wait_for(
                    self.result_queue.get(),
                    timeout=1.0
                )
                
                # Perform higher-level analysis
                await self._perform_scene_analysis(camera_idx, results, frame)
                
                # Trigger callbacks
                await self._trigger_detection_callbacks(results)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Analysis error: {e}")
                
    async def _perform_scene_analysis(self, camera_idx: int, results: Dict[str, Any], 
                                    frame: np.ndarray):
        """Perform high-level scene understanding"""
        # Analyze workspace state
        workspace_state = {
            "camera": camera_idx,
            "timestamp": results["timestamp"],
            "activity_level": self._calculate_activity_level(results["detections"]),
            "safety_score": self._calculate_safety_score(results["safety_events"]),
            "tools_in_use": len([t for t in results.get("tools", []) if t["in_use"]]),
            "people_count": len([d for d in results["detections"] if d.class_name == "person"])
        }
        
        # Detect specific activities
        activities = self._detect_activities(results["detections"], frame)
        workspace_state["activities"] = activities
        
        # Update workspace context
        logger.debug(f"Workspace state: {workspace_state}")
        
    def _calculate_activity_level(self, detections: List[Detection]) -> str:
        """Calculate overall activity level"""
        if len(detections) == 0:
            return "idle"
        elif len(detections) < 5:
            return "low"
        elif len(detections) < 15:
            return "moderate"
        else:
            return "high"
            
    def _calculate_safety_score(self, safety_events: List[SafetyEvent]) -> float:
        """Calculate safety score (0-100)"""
        if not safety_events:
            return 100.0
            
        score = 100.0
        for event in safety_events:
            if event.alert_level == SafetyAlert.INFO:
                score -= 2
            elif event.alert_level == SafetyAlert.WARNING:
                score -= 10
            elif event.alert_level == SafetyAlert.CRITICAL:
                score -= 25
            elif event.alert_level == SafetyAlert.EMERGENCY:
                score -= 50
                
        return max(0.0, score)
        
    def _detect_activities(self, detections: List[Detection], 
                          frame: np.ndarray) -> List[str]:
        """Detect ongoing activities"""
        activities = []
        
        # Simple activity detection based on objects present
        detected_classes = set(d.class_name for d in detections)
        
        if "person" in detected_classes and any(tool in detected_classes for tool in ["hammer", "drill", "saw"]):
            activities.append("construction")
            
        if "3d_printer" in detected_classes:
            activities.append("3d_printing")
            
        if "computer" in detected_classes and "person" in detected_classes:
            activities.append("design_work")
            
        return activities
        
    # Utility methods
    def _calculate_iou(self, bbox1: Tuple[int, int, int, int], 
                      bbox2: Tuple[int, int, int, int]) -> float:
        """Calculate Intersection over Union"""
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])
        
        if x2 < x1 or y2 < y1:
            return 0.0
            
        intersection = (x2 - x1) * (y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0.0
        
    def _is_in_zone(self, bbox: Tuple[int, int, int, int], 
                   zone_polygon: List[Tuple[int, int]]) -> bool:
        """Check if bounding box is in zone"""
        if not zone_polygon:
            return False
            
        # Check if center point is in polygon
        cx = (bbox[0] + bbox[2]) // 2
        cy = (bbox[1] + bbox[3]) // 2
        
        # Point in polygon test
        n = len(zone_polygon)
        inside = False
        
        p1x, p1y = zone_polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = zone_polygon[i % n]
            if cy > min(p1y, p2y):
                if cy <= max(p1y, p2y):
                    if cx <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (cy - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or cx <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
            
        return inside
        
    def _detect_safety_glasses(self, face_roi: np.ndarray) -> bool:
        """Detect if person is wearing safety glasses"""
        # Placeholder - would use specialized model
        return np.random.random() > 0.3  # 70% wearing glasses
        
    def _detect_gloves(self, person_roi: np.ndarray) -> bool:
        """Detect if person is wearing gloves"""
        # Placeholder - would use specialized model
        return np.random.random() > 0.4  # 60% wearing gloves
        
    def _check_proximity_to_equipment(self, person_bbox: Tuple[int, int, int, int], 
                                    detections: List[Detection]) -> bool:
        """Check if person is near equipment"""
        equipment_classes = ["printer", "cnc", "lathe", "saw", "drill"]
        
        for detection in detections:
            if detection.class_name in equipment_classes:
                # Simple distance check
                person_cx = (person_bbox[0] + person_bbox[2]) // 2
                person_cy = (person_bbox[1] + person_bbox[3]) // 2
                
                equip_cx = (detection.bbox[0] + detection.bbox[2]) // 2
                equip_cy = (detection.bbox[1] + detection.bbox[3]) // 2
                
                distance = np.sqrt((person_cx - equip_cx)**2 + (person_cy - equip_cy)**2)
                
                if distance < 200:  # pixels
                    return True
                    
        return False
        
    def _detect_smoke(self, frame: np.ndarray) -> bool:
        """Detect smoke or fire in frame"""
        # Placeholder - would use specialized smoke detection
        # Could analyze color histograms, motion patterns, etc.
        return False
        
    def _is_tool_in_use(self, tool_roi: np.ndarray) -> bool:
        """Determine if tool is being used"""
        # Placeholder - would analyze motion, hand proximity, etc.
        return np.random.random() > 0.5
        
    # Callback management
    def register_detection_callback(self, callback: Callable):
        """Register callback for detections"""
        self.detection_callbacks.append(callback)
        
    def register_safety_callback(self, callback: Callable):
        """Register callback for safety events"""
        self.safety_callbacks.append(callback)
        
    async def _trigger_detection_callbacks(self, results: Dict[str, Any]):
        """Trigger detection callbacks"""
        for callback in self.detection_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(results)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, results
                    )
            except Exception as e:
                logger.error(f"Detection callback error: {e}")
                
    async def _trigger_safety_callbacks(self, event: SafetyEvent):
        """Trigger safety callbacks"""
        for callback in self.safety_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, event
                    )
            except Exception as e:
                logger.error(f"Safety callback error: {e}")
                
    # Public methods
    def get_latest_frame(self, camera_idx: int) -> Optional[np.ndarray]:
        """Get latest frame from camera"""
        return self.latest_frames.get(camera_idx)
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        stats = self.stats.copy()
        stats["cameras_active"] = len(self.cameras)
        stats["safety_events_recent"] = len(self.safety_events)
        return stats
        
    def get_safety_status(self) -> Dict[str, Any]:
        """Get current safety status"""
        recent_events = list(self.safety_events)[-10:]  # Last 10 events
        
        critical_count = sum(1 for e in recent_events if e.alert_level == SafetyAlert.CRITICAL)
        warning_count = sum(1 for e in recent_events if e.alert_level == SafetyAlert.WARNING)
        
        return {
            "safety_score": self._calculate_safety_score(recent_events),
            "critical_events": critical_count,
            "warnings": warning_count,
            "ppe_compliance": self.ppe_status,
            "last_event": recent_events[-1] if recent_events else None
        }
        
    async def capture_snapshot(self, camera_idx: int) -> Optional[np.ndarray]:
        """Capture snapshot from camera"""
        frame = self.get_latest_frame(camera_idx)
        if frame is not None:
            # Run detection on snapshot
            detections = await self._detect_objects(frame)
            
            # Draw detections
            annotated = self._draw_detections(frame.copy(), detections)
            return annotated
            
        return None
        
    def _draw_detections(self, frame: np.ndarray, 
                        detections: List[Detection]) -> np.ndarray:
        """Draw detections on frame"""
        for detection in detections:
            x1, y1, x2, y2 = detection.bbox
            color = (0, 255, 0)  # Green for normal objects
            
            # Different colors for different types
            if detection.class_name == "person":
                color = (255, 0, 0)  # Blue for people
            elif "hazard" in detection.class_name.lower():
                color = (0, 0, 255)  # Red for hazards
                
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            
            # Label
            label = f"{detection.class_name}: {detection.confidence:.2f}"
            cv2.putText(frame, label, (x1, y1 - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                       
        return frame


# Example usage
async def main():
    """Example usage"""
    config = VisionConfig(
        camera_indices=[0],
        enable_ppe_detection=True,
        enable_hazard_detection=True,
        safety_zones=[
            {
                "name": "CNC Area",
                "type": "restricted",
                "polygon": [(100, 100), (400, 100), (400, 400), (100, 400)]
            }
        ]
    )
    
    processor = VisionProcessor(config)
    
    # Register callbacks
    async def on_detection(results):
        print(f"Detected {len(results['detections'])} objects")
        
    async def on_safety_event(event):
        print(f"SAFETY: {event.alert_level.value} - {event.description}")
        
    processor.register_detection_callback(on_detection)
    processor.register_safety_callback(on_safety_event)
    
    # Start processing
    await processor.start()
    
    # Run for a while
    await asyncio.sleep(30)
    
    # Get statistics
    stats = processor.get_statistics()
    print(f"Processed {stats['frames_processed']} frames")
    print(f"Average FPS: {stats['avg_fps']}")
    print(f"Safety events: {stats['safety_events']}")
    
    await processor.stop()


if __name__ == "__main__":
    asyncio.run(main())