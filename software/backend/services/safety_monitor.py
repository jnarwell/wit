"""
W.I.T. Safety Monitoring Service

Critical safety monitoring and emergency response system.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Set, Any
from datetime import datetime, timedelta
from enum import Enum
import json

from services.mqtt_service import MQTTService, MQTTTopics
from services.database import get_db_context
from models.database import SafetyEvent, Equipment, AlertSeverity
from core.config import settings

logger = logging.getLogger(__name__)


class SafetyStatus(Enum):
    """Safety system status levels"""
    SAFE = "safe"
    WARNING = "warning"
    ALERT = "alert"
    EMERGENCY = "emergency"


class EmergencyStopReason(Enum):
    """Emergency stop reasons"""
    VOICE_COMMAND = "voice_command"
    BUTTON_PRESS = "button_press"
    TEMPERATURE_CRITICAL = "temperature_critical"
    VISION_HAZARD = "vision_hazard"
    EQUIPMENT_FAULT = "equipment_fault"
    MANUAL_TRIGGER = "manual_trigger"
    WATCHDOG_TIMEOUT = "watchdog_timeout"


class SafetyMonitor:
    """Safety monitoring and emergency response system"""
    
    def __init__(self, mqtt_service: MQTTService):
        self.mqtt = mqtt_service
        self.is_running = False
        self.status = SafetyStatus.SAFE
        self.emergency_stop_active = False
        
        # Safety thresholds
        self.temp_thresholds = {
            "cpu": settings.MAX_TEMPERATURE_C,
            "gpu": settings.MAX_TEMPERATURE_C,
            "hotend": 300.0,
            "bed": 120.0,
            "chamber": 50.0
        }
        
        # Active alerts
        self.active_alerts: Dict[str, Dict[str, Any]] = {}
        
        # Equipment status tracking
        self.equipment_status: Dict[int, Dict[str, Any]] = {}
        
        # Watchdog timers
        self.watchdogs: Dict[str, float] = {}
        self.watchdog_timeouts = {
            "voice": 60.0,      # 1 minute
            "vision": 30.0,     # 30 seconds
            "equipment": 10.0,  # 10 seconds
        }
        
        # Tasks
        self._monitoring_task: Optional[asyncio.Task] = None
        self._watchdog_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start safety monitoring"""
        logger.info("Starting safety monitoring service")
        self.is_running = True
        
        # Subscribe to safety-relevant topics
        await self._setup_subscriptions()
        
        # Start monitoring tasks
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        self._watchdog_task = asyncio.create_task(self._watchdog_loop())
        
        # Publish initial status
        await self._publish_status()
        
        logger.info("Safety monitoring service started")
        
    async def stop(self):
        """Stop safety monitoring"""
        logger.info("Stopping safety monitoring service")
        self.is_running = False
        
        # Cancel tasks
        if self._monitoring_task:
            self._monitoring_task.cancel()
            await asyncio.gather(self._monitoring_task, return_exceptions=True)
            
        if self._watchdog_task:
            self._watchdog_task.cancel()
            await asyncio.gather(self._watchdog_task, return_exceptions=True)
            
        logger.info("Safety monitoring service stopped")
        
    async def _setup_subscriptions(self):
        """Setup MQTT subscriptions"""
        # Voice events
        await self.mqtt.subscribe(
            MQTTTopics.VOICE_COMMAND,
            self._handle_voice_command
        )
        
        # Equipment telemetry
        await self.mqtt.subscribe(
            "wit/equipment/+/telemetry",
            self._handle_equipment_telemetry
        )
        
        # Vision alerts
        await self.mqtt.subscribe(
            MQTTTopics.VISION_ALERT,
            self._handle_vision_alert
        )
        
        # System metrics
        await self.mqtt.subscribe(
            MQTTTopics.METRICS_SYSTEM,
            self._handle_system_metrics
        )
        
        # Emergency stop requests
        await self.mqtt.subscribe(
            "wit/safety/emergency_stop",
            self._handle_emergency_stop_request
        )
        
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_running:
            try:
                # Check all safety conditions
                await self._check_temperatures()
                await self._check_equipment_status()
                await self._check_active_alerts()
                
                # Update overall status
                await self._update_safety_status()
                
                # Sleep for monitoring interval
                await asyncio.sleep(settings.SAFETY_CHECK_INTERVAL)
                
            except Exception as e:
                logger.error(f"Error in safety monitoring: {e}", exc_info=True)
                await asyncio.sleep(1.0)
                
    async def _watchdog_loop(self):
        """Watchdog timer loop"""
        while self.is_running:
            try:
                current_time = asyncio.get_event_loop().time()
                
                # Check each watchdog
                for service, last_seen in self.watchdogs.items():
                    timeout = self.watchdog_timeouts.get(service, 60.0)
                    
                    if current_time - last_seen > timeout:
                        await self._handle_watchdog_timeout(service)
                        
                await asyncio.sleep(5.0)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in watchdog loop: {e}", exc_info=True)
                await asyncio.sleep(5.0)
                
    async def trigger_emergency_stop(self, reason: EmergencyStopReason, 
                                   details: str = ""):
        """Trigger emergency stop"""
        logger.critical(f"EMERGENCY STOP TRIGGERED: {reason.value} - {details}")
        
        self.emergency_stop_active = True
        self.status = SafetyStatus.EMERGENCY
        
        # Create safety event
        async with get_db_context() as db:
            event = SafetyEvent(
                event_type="emergency_stop",
                severity=AlertSeverity.CRITICAL,
                source=reason.value,
                title="Emergency Stop Activated",
                description=details or f"Emergency stop triggered by {reason.value}",
                actions=["all_equipment_stopped", "alerts_sent"],
                equipment_affected=list(self.equipment_status.keys())
            )
            db.add(event)
            await db.commit()
            
        # Publish emergency stop command to all equipment
        await self.mqtt.publish(
            MQTTTopics.SAFETY_EMERGENCY,
            {
                "command": "emergency_stop",
                "reason": reason.value,
                "details": details,
                "timestamp": datetime.now().isoformat()
            },
            qos=2,  # Ensure delivery
            retain=True
        )
        
        # Stop all equipment
        for equipment_id in self.equipment_status:
            await self.mqtt.publish(
                MQTTTopics.equipment_topic(equipment_id, "command"),
                {
                    "command": "emergency_stop",
                    "source": "safety_monitor",
                    "reason": reason.value
                },
                qos=2
            )
            
        # Update status
        await self._publish_status()
        
    async def clear_emergency_stop(self, cleared_by: str, notes: str = ""):
        """Clear emergency stop"""
        if not self.emergency_stop_active:
            return
            
        logger.info(f"Emergency stop cleared by {cleared_by}")
        
        self.emergency_stop_active = False
        
        # Update safety event
        async with get_db_context() as db:
            # Find the active emergency stop event
            from sqlalchemy import select, desc
            stmt = select(SafetyEvent).where(
                SafetyEvent.event_type == "emergency_stop",
                SafetyEvent.resolved == False
            ).order_by(desc(SafetyEvent.created_at)).limit(1)
            
            result = await db.execute(stmt)
            event = result.scalar_one_or_none()
            
            if event:
                event.resolved = True
                event.resolved_at = datetime.utcnow()
                event.resolved_by = cleared_by
                event.resolution_notes = notes
                await db.commit()
                
        # Clear emergency command
        await self.mqtt.publish(
            MQTTTopics.SAFETY_EMERGENCY,
            {
                "command": "clear_emergency_stop",
                "cleared_by": cleared_by,
                "timestamp": datetime.now().isoformat()
            },
            qos=2,
            retain=True
        )
        
        # Re-evaluate safety status
        await self._update_safety_status()
        
    async def _handle_voice_command(self, topic: str, payload: Dict[str, Any]):
        """Handle voice commands for safety"""
        # Update watchdog
        self.watchdogs["voice"] = asyncio.get_event_loop().time()
        
        # Check for emergency commands
        command_text = payload.get("text", "").lower()
        intent = payload.get("intent", "")
        
        emergency_phrases = [
            "emergency stop",
            "stop everything",
            "abort all",
            "kill switch"
        ]
        
        if intent == "safety" or any(phrase in command_text for phrase in emergency_phrases):
            await self.trigger_emergency_stop(
                EmergencyStopReason.VOICE_COMMAND,
                f"Voice command: {command_text}"
            )
            
    async def _handle_equipment_telemetry(self, topic: str, payload: Dict[str, Any]):
        """Handle equipment telemetry data"""
        # Extract equipment ID from topic
        parts = topic.split('/')
        if len(parts) >= 3:
            try:
                equipment_id = int(parts[2])
            except ValueError:
                return
                
            # Update equipment status
            self.equipment_status[equipment_id] = {
                "last_seen": datetime.now(),
                "temperatures": payload.get("temperatures", {}),
                "state": payload.get("state", "unknown"),
                "errors": payload.get("errors", [])
            }
            
            # Update watchdog
            self.watchdogs["equipment"] = asyncio.get_event_loop().time()
            
            # Check for critical conditions
            await self._check_equipment_safety(equipment_id, payload)
            
    async def _handle_vision_alert(self, topic: str, payload: Dict[str, Any]):
        """Handle vision system alerts"""
        # Update watchdog
        self.watchdogs["vision"] = asyncio.get_event_loop().time()
        
        alert_type = payload.get("type", "")
        severity = payload.get("severity", "info")
        
        # Handle different alert types
        if alert_type == "no_ppe":
            await self._create_alert(
                "vision_ppe",
                "PPE Not Detected",
                payload.get("details", "Safety equipment not detected"),
                AlertSeverity.WARNING
            )
        elif alert_type == "unsafe_proximity":
            await self._create_alert(
                "vision_proximity",
                "Unsafe Proximity Detected",
                payload.get("details", "Person too close to equipment"),
                AlertSeverity.ERROR
            )
        elif alert_type == "fire_detected":
            await self.trigger_emergency_stop(
                EmergencyStopReason.VISION_HAZARD,
                "Fire detected by vision system"
            )
            
    async def _handle_system_metrics(self, topic: str, payload: Dict[str, Any]):
        """Handle system metrics"""
        temperatures = payload.get("temperatures", {})
        
        # Check system temperatures
        for component, temp in temperatures.items():
            threshold = self.temp_thresholds.get(component, 85.0)
            if temp > threshold:
                await self._create_alert(
                    f"temp_{component}",
                    f"{component.upper()} Temperature Critical",
                    f"Temperature: {temp}°C (threshold: {threshold}°C)",
                    AlertSeverity.ERROR
                )
                
    async def _handle_emergency_stop_request(self, topic: str, payload: Dict[str, Any]):
        """Handle emergency stop requests"""
        source = payload.get("source", "unknown")
        reason = payload.get("reason", "Manual trigger")
        
        # Map source to reason enum
        reason_map = {
            "button": EmergencyStopReason.BUTTON_PRESS,
            "voice": EmergencyStopReason.VOICE_COMMAND,
            "vision": EmergencyStopReason.VISION_HAZARD,
            "manual": EmergencyStopReason.MANUAL_TRIGGER
        }
        
        stop_reason = reason_map.get(source, EmergencyStopReason.MANUAL_TRIGGER)
        await self.trigger_emergency_stop(stop_reason, reason)
        
    async def _check_temperatures(self):
        """Check all temperature readings"""
        for equipment_id, status in self.equipment_status.items():
            temps = status.get("temperatures", {})
            
            for sensor, temp in temps.items():
                threshold = self.temp_thresholds.get(sensor, 100.0)
                
                if temp > threshold * 0.9:  # 90% of threshold
                    severity = AlertSeverity.WARNING
                    if temp > threshold:
                        severity = AlertSeverity.ERROR
                    if temp > threshold * 1.1:  # 110% of threshold
                        severity = AlertSeverity.CRITICAL
                        
                    await self._create_alert(
                        f"temp_{equipment_id}_{sensor}",
                        f"High Temperature: {sensor}",
                        f"Equipment {equipment_id}: {temp}°C",
                        severity
                    )
                    
                    # Trigger emergency stop for critical temps
                    if severity == AlertSeverity.CRITICAL:
                        await self.trigger_emergency_stop(
                            EmergencyStopReason.TEMPERATURE_CRITICAL,
                            f"Critical temperature on equipment {equipment_id}: {sensor} = {temp}°C"
                        )
                        
    async def _check_equipment_status(self):
        """Check equipment status"""
        current_time = datetime.now()
        
        for equipment_id, status in self.equipment_status.items():
            last_seen = status.get("last_seen")
            
            if last_seen:
                # Check if equipment is offline
                if current_time - last_seen > timedelta(seconds=30):
                    await self._create_alert(
                        f"equipment_offline_{equipment_id}",
                        f"Equipment {equipment_id} Offline",
                        "No telemetry received for 30 seconds",
                        AlertSeverity.WARNING
                    )
                    
            # Check for errors
            errors = status.get("errors", [])
            if errors:
                await self._create_alert(
                    f"equipment_errors_{equipment_id}",
                    f"Equipment {equipment_id} Errors",
                    f"Errors: {', '.join(errors)}",
                    AlertSeverity.ERROR
                )
                
    async def _check_active_alerts(self):
        """Review and update active alerts"""
        # Remove resolved alerts
        resolved = []
        for alert_id, alert in self.active_alerts.items():
            if alert.get("auto_resolve", False):
                # Check if condition is resolved
                # This would be more sophisticated in production
                if datetime.now() - alert["created_at"] > timedelta(minutes=5):
                    resolved.append(alert_id)
                    
        for alert_id in resolved:
            del self.active_alerts[alert_id]
            
    async def _check_equipment_safety(self, equipment_id: int, telemetry: Dict[str, Any]):
        """Check equipment-specific safety conditions"""
        state = telemetry.get("state", "")
        errors = telemetry.get("errors", [])
        
        # Check for fault conditions
        critical_errors = [
            "thermal_runaway",
            "position_error",
            "communication_lost",
            "sensor_fault"
        ]
        
        for error in errors:
            if any(critical in error.lower() for critical in critical_errors):
                await self.trigger_emergency_stop(
                    EmergencyStopReason.EQUIPMENT_FAULT,
                    f"Critical fault on equipment {equipment_id}: {error}"
                )
                break
                
    async def _handle_watchdog_timeout(self, service: str):
        """Handle watchdog timeout"""
        logger.error(f"Watchdog timeout for service: {service}")
        
        await self._create_alert(
            f"watchdog_{service}",
            f"{service.capitalize()} Service Timeout",
            f"No heartbeat from {service} service",
            AlertSeverity.ERROR
        )
        
        # Critical services trigger emergency stop
        if service in ["vision", "equipment"]:
            await self.trigger_emergency_stop(
                EmergencyStopReason.WATCHDOG_TIMEOUT,
                f"Critical service timeout: {service}"
            )
            
    async def _create_alert(self, alert_id: str, title: str, 
                          description: str, severity: AlertSeverity):
        """Create or update alert"""
        alert = {
            "id": alert_id,
            "title": title,
            "description": description,
            "severity": severity,
            "created_at": datetime.now(),
            "auto_resolve": severity != AlertSeverity.CRITICAL
        }
        
        # Store alert
        self.active_alerts[alert_id] = alert
        
        # Publish alert
        await self.mqtt.publish(
            MQTTTopics.SAFETY_ALERT,
            {
                "alert_id": alert_id,
                "title": title,
                "description": description,
                "severity": severity.value,
                "timestamp": datetime.now().isoformat()
            }
        )
        
        # Store in database
        async with get_db_context() as db:
            event = SafetyEvent(
                event_type="alert",
                severity=severity,
                source="safety_monitor",
                title=title,
                description=description
            )
            db.add(event)
            await db.commit()
            
    async def _update_safety_status(self):
        """Update overall safety status"""
        if self.emergency_stop_active:
            self.status = SafetyStatus.EMERGENCY
        elif any(a["severity"] == AlertSeverity.CRITICAL for a in self.active_alerts.values()):
            self.status = SafetyStatus.ALERT
        elif any(a["severity"] == AlertSeverity.ERROR for a in self.active_alerts.values()):
            self.status = SafetyStatus.WARNING
        else:
            self.status = SafetyStatus.SAFE
            
        await self._publish_status()
        
    async def _publish_status(self):
        """Publish current safety status"""
        await self.mqtt.publish(
            MQTTTopics.SAFETY_STATUS,
            {
                "status": self.status.value,
                "emergency_stop_active": self.emergency_stop_active,
                "active_alerts": len(self.active_alerts),
                "monitored_equipment": len(self.equipment_status),
                "timestamp": datetime.now().isoformat()
            },
            retain=True
        )
        
    def get_status(self) -> Dict[str, Any]:
        """Get current safety status"""
        return {
            "status": self.status.value,
            "emergency_stop_active": self.emergency_stop_active,
            "alerts": list(self.active_alerts.values()),
            "equipment_status": self.equipment_status,
            "watchdogs": {
                service: asyncio.get_event_loop().time() - last_seen
                for service, last_seen in self.watchdogs.items()
            }
        }


# Export service
__all__ = ["SafetyMonitor", "SafetyStatus", "EmergencyStopReason"]