#!/bin/bash
# W.I.T. MQTT Infrastructure Setup Script

echo "🚀 Setting up MQTT Infrastructure for W.I.T..."

# Create necessary directories
mkdir -p deployment/mosquitto/config
mkdir -p software/backend/tests
mkdir -p software/backend/scripts
mkdir -p software/frontend/src/services
mkdir -p docs

# 1. Create Mosquitto configuration
echo "📝 Creating Mosquitto configuration..."
cat > deployment/mosquitto/config/mosquitto.conf << 'EOF'
# W.I.T. Mosquitto Configuration

# Listener configuration
listener 1883
protocol mqtt

# WebSocket support for web clients
listener 9001
protocol websockets

# Authentication (disabled for development)
allow_anonymous true

# Persistence
persistence true
persistence_location /mosquitto/data/

# Logging
log_dest file /mosquitto/log/mosquitto.log
log_type all
log_timestamp true
log_timestamp_format %Y-%m-%d %H:%M:%S

# Message settings
max_queued_messages 1000
max_inflight_messages 20
max_keepalive 60

# Security (for production, enable these)
# password_file /mosquitto/config/passwords
# acl_file /mosquitto/config/acl

# Bridge configuration (for cloud connectivity)
# connection wit-cloud
# address cloud.wit-terminal.com:8883
# topic # out 2 wit/local/ wit/cloud/
# topic # in 2 wit/cloud/ wit/local/
EOF

# 2. Create MQTT topic structure documentation
echo "📚 Creating MQTT documentation..."
cat > docs/mqtt_topics.md << 'EOF'
# W.I.T. MQTT Topic Structure

## Topic Naming Convention
All topics follow the pattern: `wit/{category}/{subcategory}/{identifier}`

## Core Topic Categories

### 1. System Topics
- `wit/system/status` - System-wide status updates
- `wit/system/heartbeat` - Component heartbeat messages
- `wit/system/alerts/{level}` - System alerts (info/warning/critical/emergency)
- `wit/system/logs/{component}` - Component logs

### 2. Equipment Topics
- `wit/equipment/{equipment_id}/status` - Equipment online/offline status
- `wit/equipment/{equipment_id}/telemetry` - Real-time telemetry data
- `wit/equipment/{equipment_id}/command` - Commands to equipment
- `wit/equipment/{equipment_id}/response` - Command responses
- `wit/equipment/{equipment_id}/events` - Equipment events

### 3. Job Topics
- `wit/jobs/{job_id}/status` - Job status updates
- `wit/jobs/{job_id}/progress` - Progress updates
- `wit/jobs/{job_id}/telemetry` - Job-specific telemetry
- `wit/jobs/queue` - Job queue updates

### 4. Safety Topics
- `wit/safety/alerts` - Safety alerts
- `wit/safety/zones/{zone_id}/status` - Zone status
- `wit/safety/emergency` - Emergency stop signals
- `wit/safety/sensors/{sensor_id}` - Safety sensor data

### 5. Voice/Command Topics
- `wit/voice/commands` - Voice commands
- `wit/voice/responses` - Voice responses
- `wit/voice/status` - Voice system status

### 6. Vision Topics
- `wit/vision/detections` - Object detections
- `wit/vision/alerts` - Vision-based alerts
- `wit/vision/streams/{camera_id}` - Stream status

### 7. User Interface Topics
- `wit/ui/notifications` - UI notifications
- `wit/ui/updates` - UI state updates
- `wit/ui/requests` - UI requests

## Message Formats

All messages use JSON format with standard fields:
```json
{
  "timestamp": "2024-01-20T15:30:00Z",
  "source": "component_id",
  "correlation_id": "unique_id",
  "data": {
    // Message-specific data
  }
}
```

## QoS Levels
- QoS 0: Telemetry, logs (fire-and-forget)
- QoS 1: Status updates, notifications (at least once)
- QoS 2: Commands, safety alerts (exactly once)

## Retained Messages
The following topics use retained messages:
- Equipment status
- System status
- Safety alerts
- Current job status
EOF

# 3. Create enhanced MQTT service
echo "🔧 Creating enhanced MQTT service..."
cat > software/backend/services/mqtt_service_v2.py << 'EOF'
"""
W.I.T. Enhanced MQTT Service

Production-ready MQTT service with reconnection, monitoring, and WebSocket bridge
"""
import asyncio
import json
import logging
from typing import Optional, Dict, Any, Callable, List, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import asyncio_mqtt as aiomqtt
from asyncio_mqtt import Client, MqttError, Will
from contextlib import asynccontextmanager
import aiohttp
from aiohttp import web
import weakref

logger = logging.getLogger(__name__)


@dataclass
class MQTTStats:
    """MQTT connection statistics"""
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    reconnections: int = 0
    last_connected: Optional[datetime] = None
    last_disconnected: Optional[datetime] = None
    uptime_seconds: float = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "messages_sent": self.messages_sent,
            "messages_received": self.messages_received,
            "bytes_sent": self.bytes_sent,
            "bytes_received": self.bytes_received,
            "errors": self.errors,
            "reconnections": self.reconnections,
            "last_connected": self.last_connected.isoformat() if self.last_connected else None,
            "uptime_seconds": self.uptime_seconds
        }


class MQTTService:
    """Enhanced MQTT service with production features"""
    
    def __init__(self, 
                 host: str = "localhost",
                 port: int = 1883,
                 username: Optional[str] = None,
                 password: Optional[str] = None,
                 client_id: str = "wit-backend",
                 enable_websocket_bridge: bool = True):
        
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.client_id = client_id
        self.enable_websocket_bridge = enable_websocket_bridge
        
        # Connection state
        self.client: Optional[Client] = None
        self.connected = False
        self.connecting = False
        self.should_run = True
        
        # Subscriptions
        self.subscriptions: Dict[str, List[Callable]] = {}
        self.subscription_refs: Dict[str, Set[weakref.ref]] = {}
        
        # Tasks
        self.tasks: List[asyncio.Task] = []
        
        # Statistics
        self.stats = MQTTStats()
        
        # WebSocket connections for bridge
        self.websocket_clients: Set[web.WebSocketResponse] = set()
        
        # Last will and testament
        self.will = Will(
            topic=f"wit/system/status/{self.client_id}",
            payload=json.dumps({
                "status": "offline",
                "timestamp": datetime.utcnow().isoformat()
            }).encode(),
            qos=1,
            retain=True
        )
        
    async def connect(self) -> bool:
        """Connect to MQTT broker with automatic retry"""
        if self.connected or self.connecting:
            return True
            
        self.connecting = True
        retry_count = 0
        retry_delay = 1
        
        while self.should_run and retry_count < 10:
            try:
                logger.info(f"Connecting to MQTT broker at {self.host}:{self.port}")
                
                # Create client with will
                self.client = Client(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    client_id=self.client_id,
                    will=self.will
                )
                
                # Connect
                await self.client.connect()
                
                self.connected = True
                self.connecting = False
                self.stats.last_connected = datetime.utcnow()
                
                # Start tasks
                self._start_tasks()
                
                # Publish online status
                await self._publish_status("online")
                
                # Resubscribe to topics
                await self._resubscribe()
                
                logger.info("MQTT connected successfully")
                return True
                
            except Exception as e:
                logger.error(f"MQTT connection failed (attempt {retry_count + 1}): {e}")
                retry_count += 1
                self.stats.errors += 1
                
                if retry_count < 10:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, 30)  # Exponential backoff
                    
        self.connecting = False
        return False
        
    async def disconnect(self):
        """Disconnect from MQTT broker"""
        self.should_run = False
        
        # Cancel all tasks
        for task in self.tasks:
            task.cancel()
            
        # Wait for tasks to complete
        await asyncio.gather(*self.tasks, return_exceptions=True)
        
        # Publish offline status
        if self.connected:
            await self._publish_status("offline")
            
        # Disconnect client
        if self.client:
            await self.client.disconnect()
            
        self.connected = False
        self.stats.last_disconnected = datetime.utcnow()
        logger.info("MQTT disconnected")
        
    def _start_tasks(self):
        """Start background tasks"""
        self.tasks = [
            asyncio.create_task(self._message_loop()),
            asyncio.create_task(self._heartbeat_loop()),
            asyncio.create_task(self._stats_loop()),
        ]
        
        if self.enable_websocket_bridge:
            self.tasks.append(asyncio.create_task(self._start_websocket_bridge()))
            
    async def _message_loop(self):
        """Main message processing loop"""
        try:
            async with self.client.filtered_messages("wit/#") as messages:
                await self.client.subscribe("wit/#", qos=1)
                
                async for message in messages:
                    try:
                        # Update stats
                        self.stats.messages_received += 1
                        self.stats.bytes_received += len(message.payload)
                        
                        # Decode payload
                        topic = message.topic
                        payload = self._decode_payload(message.payload)
                        
                        # Process message
                        await self._process_message(topic, payload)
                        
                        # Forward to WebSocket clients
                        await self._forward_to_websockets(topic, payload)
                        
                    except Exception as e:
                        logger.error(f"Error processing message: {e}")
                        self.stats.errors += 1
                        
        except MqttError as e:
            logger.error(f"MQTT error in message loop: {e}")
            self.connected = False
            # Trigger reconnection
            asyncio.create_task(self._reconnect())
            
    async def _heartbeat_loop(self):
        """Send periodic heartbeat"""
        while self.should_run:
            if self.connected:
                await self.publish(
                    f"system/heartbeat/{self.client_id}",
                    {
                        "timestamp": datetime.utcnow().isoformat(),
                        "uptime": self.stats.uptime_seconds,
                        "stats": self.stats.to_dict()
                    },
                    qos=0
                )
            await asyncio.sleep(30)  # Every 30 seconds
            
    async def _stats_loop(self):
        """Update statistics"""
        while self.should_run:
            if self.stats.last_connected:
                self.stats.uptime_seconds = (
                    datetime.utcnow() - self.stats.last_connected
                ).total_seconds()
            await asyncio.sleep(1)
            
    async def _reconnect(self):
        """Reconnect to broker"""
        if not self.connecting:
            self.stats.reconnections += 1
            logger.info("Attempting to reconnect...")
            await self.connect()
            
    async def _resubscribe(self):
        """Resubscribe to all topics after reconnection"""
        for topic in self.subscriptions:
            try:
                await self.client.subscribe(topic, qos=1)
                logger.debug(f"Resubscribed to {topic}")
            except Exception as e:
                logger.error(f"Failed to resubscribe to {topic}: {e}")
                
    async def _publish_status(self, status: str):
        """Publish component status"""
        await self.publish(
            f"system/status/{self.client_id}",
            {
                "status": status,
                "timestamp": datetime.utcnow().isoformat(),
                "client_id": self.client_id
            },
            qos=1,
            retain=True
        )
        
    def _decode_payload(self, payload: bytes) -> Any:
        """Decode message payload"""
        try:
            return json.loads(payload.decode())
        except json.JSONDecodeError:
            return payload.decode()
        except Exception:
            return payload
            
    async def _process_message(self, topic: str, payload: Any):
        """Process incoming message"""
        # Clean handlers with dead references
        if topic in self.subscription_refs:
            self.subscription_refs[topic] = {
                ref for ref in self.subscription_refs[topic]
                if ref() is not None
            }
            
        # Call handlers
        handlers = []
        
        # Exact topic match
        if topic in self.subscriptions:
            handlers.extend(self.subscriptions[topic])
            
        # Wildcard matches
        for sub_topic, sub_handlers in self.subscriptions.items():
            if self._topic_matches(sub_topic, topic):
                handlers.extend(sub_handlers)
                
        # Execute handlers
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(topic, payload)
                else:
                    handler(topic, payload)
            except Exception as e:
                logger.error(f"Handler error for {topic}: {e}")
                
    def _topic_matches(self, pattern: str, topic: str) -> bool:
        """Check if topic matches pattern with wildcards"""
        pattern_parts = pattern.split('/')
        topic_parts = topic.split('/')
        
        if '#' in pattern:
            # Multi-level wildcard must be at the end
            if pattern.endswith('/#'):
                pattern_prefix = pattern[:-2]
                return topic.startswith(pattern_prefix)
        
        if len(pattern_parts) != len(topic_parts):
            return False
            
        for p, t in zip(pattern_parts, topic_parts):
            if p == '+':  # Single-level wildcard
                continue
            if p != t:
                return False
                
        return True
        
    async def publish(self, topic: str, payload: Any, 
                     qos: int = 1, retain: bool = False) -> bool:
        """Publish message to MQTT broker"""
        if not self.connected:
            logger.warning(f"Cannot publish to {topic}: not connected")
            return False
            
        try:
            # Ensure topic has wit/ prefix
            if not topic.startswith("wit/"):
                topic = f"wit/{topic}"
                
            # Encode payload
            if isinstance(payload, (dict, list)):
                payload_bytes = json.dumps(payload).encode()
            elif isinstance(payload, str):
                payload_bytes = payload.encode()
            else:
                payload_bytes = bytes(payload)
                
            # Publish
            await self.client.publish(topic, payload_bytes, qos=qos, retain=retain)
            
            # Update stats
            self.stats.messages_sent += 1
            self.stats.bytes_sent += len(payload_bytes)
            
            # Forward to WebSocket clients
            await self._forward_to_websockets(topic, payload)
            
            return True
            
        except Exception as e:
            logger.error(f"Publish error on {topic}: {e}")
            self.stats.errors += 1
            return False
            
    async def subscribe(self, topic: str, handler: Callable) -> bool:
        """Subscribe to MQTT topic"""
        try:
            # Ensure topic has wit/ prefix
            if not topic.startswith("wit/"):
                topic = f"wit/{topic}"
                
            # Add handler
            if topic not in self.subscriptions:
                self.subscriptions[topic] = []
                self.subscription_refs[topic] = set()
                
                # Subscribe if connected
                if self.connected:
                    await self.client.subscribe(topic, qos=1)
                    
            self.subscriptions[topic].append(handler)
            
            # Store weak reference for cleanup
            if hasattr(handler, '__self__'):
                self.subscription_refs[topic].add(weakref.ref(handler.__self__))
                
            logger.debug(f"Subscribed to {topic}")
            return True
            
        except Exception as e:
            logger.error(f"Subscribe error on {topic}: {e}")
            return False
            
    async def unsubscribe(self, topic: str, handler: Optional[Callable] = None) -> bool:
        """Unsubscribe from MQTT topic"""
        try:
            # Ensure topic has wit/ prefix
            if not topic.startswith("wit/"):
                topic = f"wit/{topic}"
                
            if topic not in self.subscriptions:
                return True
                
            if handler:
                # Remove specific handler
                self.subscriptions[topic] = [
                    h for h in self.subscriptions[topic] if h != handler
                ]
            else:
                # Remove all handlers
                self.subscriptions[topic] = []
                
            # Unsubscribe if no handlers left
            if not self.subscriptions[topic]:
                del self.subscriptions[topic]
                if topic in self.subscription_refs:
                    del self.subscription_refs[topic]
                    
                if self.connected:
                    await self.client.unsubscribe(topic)
                    
            logger.debug(f"Unsubscribed from {topic}")
            return True
            
        except Exception as e:
            logger.error(f"Unsubscribe error on {topic}: {e}")
            return False
            
    # WebSocket Bridge for web clients
    async def _start_websocket_bridge(self):
        """Start WebSocket bridge server"""
        app = web.Application()
        app.router.add_get('/mqtt-ws', self._websocket_handler)
        
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', 8765)
        await site.start()
        
        logger.info("WebSocket bridge started on ws://localhost:8765/mqtt-ws")
        
    async def _websocket_handler(self, request):
        """Handle WebSocket connections"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        self.websocket_clients.add(ws)
        logger.info(f"WebSocket client connected. Total: {len(self.websocket_clients)}")
        
        try:
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        
                        # Handle subscription requests
                        if data.get('action') == 'subscribe':
                            topic = data.get('topic')
                            # Subscribe on behalf of WebSocket client
                            await self.subscribe(topic, lambda t, p: None)
                            
                        # Handle publish requests
                        elif data.get('action') == 'publish':
                            topic = data.get('topic')
                            payload = data.get('payload')
                            await self.publish(topic, payload)
                            
                    except Exception as e:
                        logger.error(f"WebSocket message error: {e}")
                        
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f'WebSocket error: {ws.exception()}')
                    
        except Exception as e:
            logger.error(f"WebSocket handler error: {e}")
            
        finally:
            self.websocket_clients.discard(ws)
            logger.info(f"WebSocket client disconnected. Total: {len(self.websocket_clients)}")
            
        return ws
        
    async def _forward_to_websockets(self, topic: str, payload: Any):
        """Forward MQTT messages to WebSocket clients"""
        if not self.websocket_clients:
            return
            
        message = json.dumps({
            "topic": topic,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Send to all connected clients
        disconnected = set()
        for ws in self.websocket_clients:
            try:
                await ws.send_str(message)
            except ConnectionResetError:
                disconnected.add(ws)
                
        # Clean up disconnected clients
        self.websocket_clients -= disconnected
        
    # Convenience methods
    async def publish_telemetry(self, source: str, metrics: Dict[str, float]):
        """Publish telemetry data"""
        return await self.publish(
            f"equipment/{source}/telemetry",
            {
                "metrics": metrics,
                "timestamp": datetime.utcnow().isoformat()
            },
            qos=0
        )
        
    async def publish_event(self, category: str, event_type: str, data: Dict[str, Any]):
        """Publish event"""
        return await self.publish(
            f"events/{category}/{event_type}",
            {
                "data": data,
                "timestamp": datetime.utcnow().isoformat(),
                "source": self.client_id
            },
            qos=1
        )
        
    async def publish_alert(self, level: str, message: str, details: Optional[Dict] = None):
        """Publish alert"""
        return await self.publish(
            f"system/alerts/{level}",
            {
                "message": message,
                "details": details or {},
                "timestamp": datetime.utcnow().isoformat(),
                "source": self.client_id
            },
            qos=2,
            retain=True
        )
        
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            **self.stats.to_dict(),
            "connected": self.connected,
            "subscriptions": list(self.subscriptions.keys()),
            "websocket_clients": len(self.websocket_clients)
        }


# Singleton instance
mqtt_service = MQTTService()
EOF

# 4. Create MQTT testing utilities
echo "🧪 Creating test utilities..."
cat > software/backend/tests/test_mqtt.py << 'EOF'
"""
MQTT Service Tests
"""
import asyncio
import pytest
from datetime import datetime

from software.backend.services.mqtt_service_v2 import MQTTService


@pytest.mark.asyncio
async def test_mqtt_connection():
    """Test MQTT connection"""
    mqtt = MQTTService(client_id="test-client")
    
    # Connect
    connected = await mqtt.connect()
    assert connected
    assert mqtt.connected
    
    # Disconnect
    await mqtt.disconnect()
    assert not mqtt.connected


@pytest.mark.asyncio
async def test_publish_subscribe():
    """Test publish and subscribe"""
    mqtt = MQTTService(client_id="test-pubsub")
    await mqtt.connect()
    
    received_messages = []
    
    async def handler(topic, payload):
        received_messages.append((topic, payload))
    
    # Subscribe
    await mqtt.subscribe("test/topic", handler)
    
    # Publish
    test_data = {"test": "data", "number": 42}
    await mqtt.publish("test/topic", test_data)
    
    # Wait for message
    await asyncio.sleep(0.1)
    
    # Check received
    assert len(received_messages) == 1
    assert received_messages[0][0] == "wit/test/topic"
    assert received_messages[0][1]["test"] == "data"
    
    await mqtt.disconnect()


@pytest.mark.asyncio
async def test_wildcard_subscription():
    """Test wildcard subscriptions"""
    mqtt = MQTTService(client_id="test-wildcard")
    await mqtt.connect()
    
    received = []
    
    async def handler(topic, payload):
        received.append(topic)
    
    # Subscribe with wildcard
    await mqtt.subscribe("equipment/+/status", handler)
    
    # Publish to matching topics
    await mqtt.publish("equipment/printer1/status", {"status": "online"})
    await mqtt.publish("equipment/cnc1/status", {"status": "offline"})
    await mqtt.publish("equipment/printer1/telemetry", {"temp": 205})  # Should not match
    
    await asyncio.sleep(0.1)
    
    # Check only status messages received
    assert len(received) == 2
    assert all("status" in topic for topic in received)
    
    await mqtt.disconnect()


@pytest.mark.asyncio
async def test_retained_messages():
    """Test retained messages"""
    # First client publishes retained message
    mqtt1 = MQTTService(client_id="test-retained-pub")
    await mqtt1.connect()
    
    await mqtt1.publish(
        "system/config/test",
        {"setting": "value"},
        retain=True
    )
    
    await mqtt1.disconnect()
    
    # Second client should receive retained message
    mqtt2 = MQTTService(client_id="test-retained-sub")
    await mqtt2.connect()
    
    received = []
    
    async def handler(topic, payload):
        received.append(payload)
    
    await mqtt2.subscribe("system/config/test", handler)
    
    # Wait for retained message
    await asyncio.sleep(0.1)
    
    assert len(received) == 1
    assert received[0]["setting"] == "value"
    
    await mqtt2.disconnect()


if __name__ == "__main__":
    asyncio.run(test_mqtt_connection())
    print("✓ Basic tests passed")
EOF

# 5. Create MQTT monitoring dashboard script
echo "📊 Creating monitoring tools..."
cat > software/backend/scripts/mqtt_monitor.py << 'EOF'
#!/usr/bin/env python3
"""
MQTT Monitor - Real-time monitoring of MQTT traffic
"""
import asyncio
import sys
from datetime import datetime
from collections import defaultdict
import json

sys.path.append(".")
from software.backend.services.mqtt_service_v2 import MQTTService


class MQTTMonitor:
    def __init__(self):
        self.mqtt = MQTTService(client_id="wit-monitor")
        self.message_counts = defaultdict(int)
        self.last_messages = {}
        
    async def message_handler(self, topic, payload):
        """Handle all incoming messages"""
        self.message_counts[topic] += 1
        self.last_messages[topic] = {
            "payload": payload,
            "timestamp": datetime.utcnow()
        }
        
        # Print message
        print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] {topic}")
        if isinstance(payload, dict):
            print(json.dumps(payload, indent=2))
        else:
            print(payload)
            
    async def run(self):
        """Run the monitor"""
        print("W.I.T. MQTT Monitor")
        print("=" * 50)
        print("Connecting to MQTT broker...")
        
        await self.mqtt.connect()
        print("Connected! Monitoring all topics...")
        print("Press Ctrl+C to stop\n")
        
        # Subscribe to all topics
        await self.mqtt.subscribe("wit/#", self.message_handler)
        
        # Keep running
        try:
            while True:
                await asyncio.sleep(60)
                
                # Print statistics
                print(f"\n--- Statistics at {datetime.utcnow().strftime('%H:%M:%S')} ---")
                print(f"Total topics seen: {len(self.message_counts)}")
                print(f"Total messages: {sum(self.message_counts.values())}")
                
                # Top topics
                top_topics = sorted(
                    self.message_counts.items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )[:5]
                
                print("\nTop 5 topics by message count:")
                for topic, count in top_topics:
                    print(f"  {topic}: {count} messages")
                print("-" * 50)
                
        except KeyboardInterrupt:
            print("\nShutting down...")
            
        await self.mqtt.disconnect()


if __name__ == "__main__":
    monitor = MQTTMonitor()
    asyncio.run(monitor.run())
EOF

chmod +x software/backend/scripts/mqtt_monitor.py

# 6. Create WebSocket client for frontend
echo "🌐 Creating frontend MQTT client..."
cat > software/frontend/src/services/mqtt-client.js << 'EOF'
/**
 * MQTT WebSocket Client for W.I.T. Frontend
 */

class MQTTClient {
    constructor(url = 'ws://localhost:8765/mqtt-ws') {
        this.url = url;
        this.ws = null;
        this.subscriptions = new Map();
        this.connected = false;
        this.reconnectTimer = null;
        this.reconnectDelay = 1000;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.onopen = () => {
                    console.log('MQTT WebSocket connected');
                    this.connected = true;
                    this.reconnectDelay = 1000;
                    
                    // Resubscribe to topics
                    for (const topic of this.subscriptions.keys()) {
                        this.subscribe(topic);
                    }
                    
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (e) {
                        console.error('Failed to parse MQTT message:', e);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('MQTT WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('MQTT WebSocket disconnected');
                    this.connected = false;
                    this.scheduleReconnect();
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.connected = false;
    }
    
    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        this.reconnectTimer = setTimeout(() => {
            console.log('Attempting to reconnect MQTT WebSocket...');
            this.connect().catch(err => {
                console.error('Reconnection failed:', err);
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
            });
            this.reconnectTimer = null;
        }, this.reconnectDelay);
    }
    
    subscribe(topic, callback) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, new Set());
            
            // Send subscription request if connected
            if (this.connected && this.ws) {
                this.ws.send(JSON.stringify({
                    action: 'subscribe',
                    topic: topic
                }));
            }
        }
        
        if (callback) {
            this.subscriptions.get(topic).add(callback);
        }
    }
    
    unsubscribe(topic, callback) {
        if (this.subscriptions.has(topic)) {
            const callbacks = this.subscriptions.get(topic);
            if (callback) {
                callbacks.delete(callback);
            }
            
            if (!callback || callbacks.size === 0) {
                this.subscriptions.delete(topic);
                
                // Send unsubscribe request if connected
                if (this.connected && this.ws) {
                    this.ws.send(JSON.stringify({
                        action: 'unsubscribe',
                        topic: topic
                    }));
                }
            }
        }
    }
    
    publish(topic, payload) {
        if (!this.connected || !this.ws) {
            console.warn('Cannot publish: not connected');
            return false;
        }
        
        try {
            this.ws.send(JSON.stringify({
                action: 'publish',
                topic: topic,
                payload: payload
            }));
            return true;
        } catch (error) {
            console.error('Failed to publish:', error);
            return false;
        }
    }
    
    handleMessage(message) {
        const { topic, payload } = message;
        
        // Check exact topic match
        if (this.subscriptions.has(topic)) {
            const callbacks = this.subscriptions.get(topic);
            callbacks.forEach(callback => {
                try {
                    callback(topic, payload);
                } catch (e) {
                    console.error('Callback error:', e);
                }
            });
        }
        
        // Check wildcard matches
        for (const [pattern, callbacks] of this.subscriptions) {
            if (this.topicMatches(pattern, topic)) {
                callbacks.forEach(callback => {
                    try {
                        callback(topic, payload);
                    } catch (e) {
                        console.error('Callback error:', e);
                    }
                });
            }
        }
    }
    
    topicMatches(pattern, topic) {
        if (pattern === topic) return true;
        
        const patternParts = pattern.split('/');
        const topicParts = topic.split('/');
        
        if (pattern.includes('#')) {
            // Multi-level wildcard
            const hashIndex = patternParts.indexOf('#');
            if (hashIndex !== patternParts.length - 1) return false;
            
            for (let i = 0; i < hashIndex; i++) {
                if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
                    return false;
                }
            }
            return true;
        }
        
        if (patternParts.length !== topicParts.length) return false;
        
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
                return false;
            }
        }
        
        return true;
    }
}

// Export singleton instance
export default new MQTTClient();
EOF

# 7. Update .env with MQTT settings
echo "⚙️ Updating environment configuration..."
cat >> .env << 'EOF'

# MQTT Configuration
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=wit-backend
EOF

# 8. Create test publisher
echo "🔬 Creating test publisher..."
cat > test_mqtt_publish.py << 'EOF'
#!/usr/bin/env python3
"""Quick MQTT publish test"""
import asyncio
from software.backend.services.mqtt_service_v2 import MQTTService

async def test_publish():
    mqtt = MQTTService(client_id="test-publisher")
    await mqtt.connect()
    
    # Publish some test messages
    await mqtt.publish("system/test", {"message": "Hello WIT!"})
    await mqtt.publish_telemetry("printer1", {"temp": 205.5, "progress": 45.2})
    await mqtt.publish_alert("info", "Test alert from MQTT system")
    
    print("✓ Test messages published!")
    await mqtt.disconnect()

if __name__ == "__main__":
    asyncio.run(test_publish())
EOF

chmod +x test_mqtt_publish.py

# 9. Update requirements if needed
echo "📦 Updating requirements..."
if ! grep -q "asyncio-mqtt" software/backend/requirements.txt; then
    cat >> software/backend/requirements.txt << 'EOF'

# MQTT dependencies
asyncio-mqtt==0.16.2
aiohttp==3.9.1
EOF
fi

echo "✅ MQTT Infrastructure setup complete!"
echo ""
echo "📡 What we've built:"
echo "  ✓ Enhanced MQTT service with reconnection and monitoring"
echo "  ✓ Mosquitto configuration for development"
echo "  ✓ WebSocket bridge for web clients"
echo "  ✓ Topic structure documentation"
echo "  ✓ Monitoring tools and test utilities"
echo "  ✓ JavaScript client for frontend integration"
echo ""
echo "🚀 To get started:"
echo ""
echo "1. Start the MQTT broker:"
echo "   docker-compose up -d mqtt"
echo ""
echo "2. Monitor MQTT traffic:"
echo "   python3 software/backend/scripts/mqtt_monitor.py"
echo ""
echo "3. Test publishing:"
echo "   python3 test_mqtt_publish.py"
echo ""
echo "4. The MQTT infrastructure now provides:"
echo "   - Real-time equipment status updates"
echo "   - Telemetry streaming"
echo "   - Event broadcasting"
echo "   - WebSocket bridge for web clients"
echo "   - Automatic reconnection"
echo "   - Message persistence"
echo ""
echo "💡 The MQTT system is ready to handle all real-time"
echo "   communication for equipment, sensors, and UI updates!"