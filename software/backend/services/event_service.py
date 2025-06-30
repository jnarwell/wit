"""
W.I.T. Event Service

File: software/backend/services/event_service.py

High-level event management service built on top of MQTT.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, Callable, List, Set
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import uuid

from .mqtt_service import MQTTService

# Configure logging
logger = logging.getLogger(__name__)


class EventPriority(Enum):
    """Event priority levels"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class EventCategory(Enum):
    """Event categories"""
    SYSTEM = "system"
    EQUIPMENT = "equipment"
    SAFETY = "safety"
    WORKFLOW = "workflow"
    USER = "user"
    SENSOR = "sensor"
    AI = "ai"


@dataclass
class Event:
    """Event data structure"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    category: EventCategory = EventCategory.SYSTEM
    priority: EventPriority = EventPriority.NORMAL
    source: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "type": self.type,
            "category": self.category.value,
            "priority": self.priority.value,
            "source": self.source,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Event":
        """Create from dictionary"""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            type=data.get("type", ""),
            category=EventCategory(data.get("category", "system")),
            priority=EventPriority(data.get("priority", 1)),
            source=data.get("source", ""),
            data=data.get("data", {}),
            timestamp=datetime.fromisoformat(data.get("timestamp", datetime.now().isoformat())),
            correlation_id=data.get("correlation_id")
        )


@dataclass
class EventFilter:
    """Event filter criteria"""
    types: Optional[Set[str]] = None
    categories: Optional[Set[EventCategory]] = None
    sources: Optional[Set[str]] = None
    min_priority: Optional[EventPriority] = None
    
    def matches(self, event: Event) -> bool:
        """Check if event matches filter"""
        if self.types and event.type not in self.types:
            return False
        if self.categories and event.category not in self.categories:
            return False
        if self.sources and event.source not in self.sources:
            return False
        if self.min_priority and event.priority.value < self.min_priority.value:
            return False
        return True


class EventService:
    """High-level event management service"""
    
    def __init__(self, mqtt_service: MQTTService):
        self.mqtt = mqtt_service
        self.source_id = "event_service"
        
        # Local event handlers
        self.handlers: Dict[str, List[Callable]] = {}
        self.filters: Dict[Callable, EventFilter] = {}
        
        # Event history (limited buffer)
        self.event_history: List[Event] = []
        self.max_history_size = 1000
        
        # Event statistics
        self.stats = {
            "events_published": 0,
            "events_received": 0,
            "events_processed": 0,
            "errors": 0
        }
        
        # Initialize MQTT subscriptions
        asyncio.create_task(self._init_subscriptions())
        
    async def _init_subscriptions(self):
        """Initialize MQTT subscriptions"""
        # Subscribe to all events
        await self.mqtt.subscribe("events/+/+", self._handle_mqtt_event)
        logger.info("Event service initialized")
        
    async def _handle_mqtt_event(self, topic: str, data: Any):
        """Handle incoming MQTT event"""
        try:
            # Parse topic: wit/events/{category}/{type}
            parts = topic.split('/')
            if len(parts) >= 4:
                category = parts[-2]
                event_type = parts[-1]
                
                # Create event from MQTT data
                if isinstance(data, dict):
                    event_data = data.copy()
                else:
                    event_data = {"raw_data": data}
                    
                event = Event(
                    type=event_type,
                    category=EventCategory(category),
                    data=event_data,
                    source=event_data.pop("source", "mqtt"),
                    timestamp=datetime.fromisoformat(
                        event_data.pop("timestamp", datetime.now().isoformat())
                    )
                )
                
                # Process event
                await self._process_event(event)
                
        except Exception as e:
            logger.error(f"Error handling MQTT event: {e}")
            self.stats["errors"] += 1
            
    async def _process_event(self, event: Event):
        """Process incoming event"""
        self.stats["events_received"] += 1
        
        # Add to history
        self.event_history.append(event)
        if len(self.event_history) > self.max_history_size:
            self.event_history.pop(0)
            
        # Find matching handlers
        handlers_to_call = []
        
        # Check specific type handlers
        if event.type in self.handlers:
            handlers_to_call.extend(self.handlers[event.type])
            
        # Check wildcard handlers
        if "*" in self.handlers:
            handlers_to_call.extend(self.handlers["*"])
            
        # Apply filters and call handlers
        for handler in set(handlers_to_call):
            try:
                # Check filter if exists
                if handler in self.filters:
                    if not self.filters[handler].matches(event):
                        continue
                        
                # Call handler
                if asyncio.iscoroutinefunction(handler):
                    await handler(event.type, event.data)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, handler, event.type, event.data
                    )
                    
                self.stats["events_processed"] += 1
                
            except Exception as e:
                logger.error(f"Event handler error: {e}")
                self.stats["errors"] += 1
                
    # Public methods
    async def publish(self, event_type: str, data: Dict[str, Any], 
                     category: EventCategory = EventCategory.SYSTEM,
                     priority: EventPriority = EventPriority.NORMAL,
                     correlation_id: Optional[str] = None) -> bool:
        """Publish an event"""
        try:
            # Create event
            event = Event(
                type=event_type,
                category=category,
                priority=priority,
                source=self.source_id,
                data=data,
                correlation_id=correlation_id
            )
            
            # Publish to MQTT
            topic = f"events/{category.value}/{event_type}"
            success = await self.mqtt.publish(
                topic,
                event.to_dict(),
                qos=2 if priority == EventPriority.CRITICAL else 1
            )
            
            if success:
                self.stats["events_published"] += 1
                
                # Also process locally
                await self._process_event(event)
                
            return success
            
        except Exception as e:
            logger.error(f"Error publishing event: {e}")
            self.stats["errors"] += 1
            return False
            
    def subscribe(self, event_type: str, handler: Callable, 
                 filter: Optional[EventFilter] = None):
        """Subscribe to events"""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
            
        self.handlers[event_type].append(handler)
        
        if filter:
            self.filters[handler] = filter
            
        logger.debug(f"Subscribed to {event_type}")
        
    def unsubscribe(self, event_type: str, handler: Callable):
        """Unsubscribe from events"""
        if event_type in self.handlers:
            self.handlers[event_type] = [
                h for h in self.handlers[event_type] if h != handler
            ]
            
        if handler in self.filters:
            del self.filters[handler]
            
        logger.debug(f"Unsubscribed from {event_type}")
        
    # Convenience methods for common events
    async def publish_system_event(self, event_type: str, 
                                  message: str, 
                                  details: Optional[Dict[str, Any]] = None):
        """Publish system event"""
        await self.publish(
            event_type,
            {
                "message": message,
                **(details or {})
            },
            category=EventCategory.SYSTEM
        )
        
    async def publish_equipment_event(self, equipment_id: str, 
                                    event_type: str,
                                    data: Dict[str, Any]):
        """Publish equipment event"""
        await self.publish(
            event_type,
            {
                "equipment_id": equipment_id,
                **data
            },
            category=EventCategory.EQUIPMENT
        )
        
    async def publish_safety_event(self, event_type: str,
                                 alert_level: str,
                                 message: str,
                                 location: Optional[str] = None):
        """Publish safety event"""
        await self.publish(
            event_type,
            {
                "alert_level": alert_level,
                "message": message,
                "location": location
            },
            category=EventCategory.SAFETY,
            priority=EventPriority.HIGH if alert_level in ["critical", "emergency"] 
                     else EventPriority.NORMAL
        )
        
    async def publish_workflow_event(self, workflow_id: str,
                                   event_type: str,
                                   step: Optional[str] = None,
                                   progress: Optional[float] = None):
        """Publish workflow event"""
        await self.publish(
            event_type,
            {
                "workflow_id": workflow_id,
                "step": step,
                "progress": progress
            },
            category=EventCategory.WORKFLOW
        )
        
    async def publish_ai_event(self, model: str,
                             event_type: str,
                             input_data: Optional[Any] = None,
                             output_data: Optional[Any] = None,
                             confidence: Optional[float] = None):
        """Publish AI event"""
        await self.publish(
            event_type,
            {
                "model": model,
                "input": input_data,
                "output": output_data,
                "confidence": confidence
            },
            category=EventCategory.AI
        )
        
    async def request_response(self, event_type: str,
                             request_data: Dict[str, Any],
                             timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        """Publish event and wait for response"""
        correlation_id = str(uuid.uuid4())
        response_event = f"response.{correlation_id}"
        
        # Setup response handler
        response_future = asyncio.Future()
        
        def response_handler(event_type: str, data: Dict[str, Any]):
            response_future.set_result(data)
            
        # Subscribe to response
        self.subscribe(response_event, response_handler)
        
        # Publish request
        await self.publish(
            event_type,
            {
                **request_data,
                "response_event": response_event
            },
            correlation_id=correlation_id
        )
        
        try:
            # Wait for response
            response = await asyncio.wait_for(response_future, timeout=timeout)
            return response
            
        except asyncio.TimeoutError:
            logger.warning(f"Request timeout for {event_type}")
            return None
            
        finally:
            # Unsubscribe
            self.unsubscribe(response_event, response_handler)
            
    def get_event_history(self, 
                         event_type: Optional[str] = None,
                         category: Optional[EventCategory] = None,
                         limit: int = 100) -> List[Event]:
        """Get event history"""
        filtered_events = []
        
        for event in reversed(self.event_history):
            if event_type and event.type != event_type:
                continue
            if category and event.category != category:
                continue
                
            filtered_events.append(event)
            
            if len(filtered_events) >= limit:
                break
                
        return filtered_events
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            "stats": self.stats.copy(),
            "history_size": len(self.event_history),
            "handlers": {
                event_type: len(handlers) 
                for event_type, handlers in self.handlers.items()
            }
        }
        
    def clear_history(self):
        """Clear event history"""
        self.event_history.clear()
        logger.info("Event history cleared")


# Example usage
async def main():
    """Example usage"""
    # Create MQTT service
    mqtt = MQTTService()
    await mqtt.connect()
    
    # Create event service
    events = EventService(mqtt)
    
    # Subscribe to events
    async def on_safety_event(event_type: str, data: Dict[str, Any]):
        print(f"Safety event: {event_type} - {data}")
        
    events.subscribe("*", on_safety_event, EventFilter(
        categories={EventCategory.SAFETY}
    ))
    
    # Publish events
    await events.publish_system_event(
        "startup",
        "System started successfully",
        {"version": "1.0.0"}
    )
    
    await events.publish_equipment_event(
        "printer1",
        "print_started",
        {
            "file": "bracket.gcode",
            "estimated_time": 3600
        }
    )
    
    await events.publish_safety_event(
        "ppe_warning",
        "warning",
        "Person detected without safety glasses",
        "workbench_1"
    )
    
    # Wait a bit
    await asyncio.sleep(2)
    
    # Get history
    history = events.get_event_history(category=EventCategory.SAFETY)
    print(f"Safety events: {len(history)}")
    
    # Get statistics
    stats = events.get_statistics()
    print(f"Statistics: {json.dumps(stats, indent=2)}")
    
    # Cleanup
    await mqtt.disconnect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())