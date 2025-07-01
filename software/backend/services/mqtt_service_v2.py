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
