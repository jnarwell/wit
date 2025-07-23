"""
W.I.T. MQTT Service

File: software/backend/services/mqtt_service.py

MQTT messaging service for inter-component communication.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, Callable, List
from datetime import datetime
import aiomqtt
from aiomqtt import Client, MqttError
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class MQTTConfig:
    """MQTT connection configuration"""
    host: str = "localhost"
    port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None
    client_id: str = "wit-backend"
    keepalive: int = 60
    clean_session: bool = True
    
    # QoS levels for different message types
    qos_default: int = 1
    qos_commands: int = 2
    qos_telemetry: int = 0
    
    # Topic prefixes
    topic_prefix: str = "wit"
    
    # Reconnection settings
    reconnect_interval: int = 5
    max_reconnect_attempts: int = 10


class MQTTService:
    """MQTT messaging service"""
    
    def __init__(self, host: str = "localhost", port: int = 1883, 
                 username: Optional[str] = None, password: Optional[str] = None):
        self.config = MQTTConfig(
            host=host,
            port=port,
            username=username,
            password=password
        )
        
        self.client: Optional[Client] = None
        self.connected = False
        self.subscriptions: Dict[str, List[Callable]] = {}
        self.subscription_task: Optional[asyncio.Task] = None
        self.reconnect_task: Optional[asyncio.Task] = None
        
        # Message statistics
        self.stats = {
            "messages_sent": 0,
            "messages_received": 0,
            "errors": 0,
            "reconnections": 0
        }
        
    async def connect(self) -> bool:
        """Connect to MQTT broker"""
        try:
            logger.info(f"Connecting to MQTT broker at {self.config.host}:{self.config.port}")
            
            # Create client
            self.client = aiomqtt.Client(
                hostname=self.config.host,
                port=self.config.port,
                username=self.config.username,
                password=self.config.password,
                client_id=self.config.client_id,
                keepalive=self.config.keepalive,
                clean_session=self.config.clean_session
            )
            
            # Connect
            await self.client.connect()
            self.connected = True
            
            # Start subscription handler
            self.subscription_task = asyncio.create_task(self._subscription_handler())
            
            # Subscribe to system topics
            await self._subscribe_system_topics()
            
            logger.info("Connected to MQTT broker")
            
            # Publish connection status
            await self.publish(
                "system/status",
                {
                    "service": "backend",
                    "status": "connected",
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            self.connected = False
            
            # Start reconnection task
            if not self.reconnect_task or self.reconnect_task.done():
                self.reconnect_task = asyncio.create_task(self._reconnect_loop())
                
            return False
            
    async def disconnect(self):
        """Disconnect from MQTT broker"""
        logger.info("Disconnecting from MQTT broker")
        
        # Cancel tasks
        if self.subscription_task:
            self.subscription_task.cancel()
            
        if self.reconnect_task:
            self.reconnect_task.cancel()
            
        # Publish disconnection status
        if self.connected:
            try:
                await self.publish(
                    "system/status",
                    {
                        "service": "backend",
                        "status": "disconnecting",
                        "timestamp": datetime.now().isoformat()
                    }
                )
            except:
                pass
                
        # Explicitly exit the context manager
        if self.client:
            await self.client.__aexit__(None, None, None)
            
        self.connected = False
        logger.info("Disconnected from MQTT broker")
        
    async def _reconnect_loop(self):
        """Reconnection loop"""
        attempts = 0
        
        while attempts < self.config.max_reconnect_attempts:
            if self.connected:
                break
                
            attempts += 1
            logger.info(f"Reconnection attempt {attempts}/{self.config.max_reconnect_attempts}")
            
            try:
                await asyncio.sleep(self.config.reconnect_interval)
                await self.connect()
                
                if self.connected:
                    self.stats["reconnections"] += 1
                    break
                    
            except Exception as e:
                logger.error(f"Reconnection failed: {e}")
                
        if not self.connected:
            logger.error("Max reconnection attempts reached")
            
    async def _subscription_handler(self):
        """Handle incoming messages"""
        if not self.client:
            return
            
        try:
            async with self.client.messages() as messages:
                async for message in messages:
                    asyncio.create_task(self._process_message(message))
                    
        except asyncio.CancelledError:
            logger.info("Subscription handler cancelled")
        except Exception as e:
            logger.error(f"Subscription handler error: {e}")
            self.stats["errors"] += 1
            self.connected = False
            
    async def _process_message(self, message):
        """Process incoming message"""
        try:
            topic = str(message.topic)
            payload = message.payload.decode('utf-8')
            
            # Try to parse as JSON
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                data = payload
                
            self.stats["messages_received"] += 1
            
            # Log message
            logger.debug(f"Received message on {topic}: {payload[:100]}")
            
            # Find matching subscriptions
            for pattern, callbacks in self.subscriptions.items():
                if self._topic_matches(pattern, topic):
                    for callback in callbacks:
                        try:
                            if asyncio.iscoroutinefunction(callback):
                                await callback(topic, data)
                            else:
                                await asyncio.get_event_loop().run_in_executor(
                                    None, callback, topic, data
                                )
                        except Exception as e:
                            logger.error(f"Callback error for {topic}: {e}")
                            
        except Exception as e:
            logger.error(f"Message processing error: {e}")
            self.stats["errors"] += 1
            
    def _topic_matches(self, pattern: str, topic: str) -> bool:
        """Check if topic matches pattern (supports wildcards)"""
        if pattern == topic:
            return True
            
        pattern_parts = pattern.split('/')
        topic_parts = topic.split('/')
        
        if len(pattern_parts) != len(topic_parts) and '#' not in pattern:
            return False
            
        for i, (p, t) in enumerate(zip(pattern_parts, topic_parts)):
            if p == '#':
                return True
            elif p == '+':
                continue
            elif p != t:
                return False
                
        return True
        
    async def _subscribe_system_topics(self):
        """Subscribe to system topics"""
        system_topics = [
            f"{self.config.topic_prefix}/system/#",
            f"{self.config.topic_prefix}/command/#",
            f"{self.config.topic_prefix}/telemetry/#",
            f"{self.config.topic_prefix}/alerts/#"
        ]
        
        for topic in system_topics:
            await self.client.subscribe(topic)
            logger.debug(f"Subscribed to {topic}")
            
    # Public methods
    async def publish(self, topic: str, payload: Any, qos: Optional[int] = None, 
                     retain: bool = False) -> bool:
        """Publish message to topic"""
        if not self.connected or not self.client:
            logger.warning(f"Cannot publish to {topic}: not connected")
            return False
            
        try:
            # Add topic prefix if not present
            if not topic.startswith(self.config.topic_prefix):
                topic = f"{self.config.topic_prefix}/{topic}"
                
            # Convert payload to JSON if needed
            if isinstance(payload, (dict, list)):
                payload = json.dumps(payload)
            elif not isinstance(payload, (str, bytes)):
                payload = str(payload)
                
            # Use default QoS if not specified
            if qos is None:
                qos = self.config.qos_default
                
            # Publish message
            await self.client.publish(
                topic,
                payload=payload,
                qos=qos,
                retain=retain
            )
            
            self.stats["messages_sent"] += 1
            logger.debug(f"Published to {topic}")
            
            return True
            
        except Exception as e:
            logger.error(f"Publish error on {topic}: {e}")
            self.stats["errors"] += 1
            return False
            
    async def subscribe(self, topic: str, callback: Callable) -> bool:
        """Subscribe to topic with callback"""
        if not self.connected or not self.client:
            logger.warning(f"Cannot subscribe to {topic}: not connected")
            return False
            
        try:
            # Add topic prefix if not present
            if not topic.startswith(self.config.topic_prefix):
                topic = f"{self.config.topic_prefix}/{topic}"
                
            # Add to local subscriptions
            if topic not in self.subscriptions:
                self.subscriptions[topic] = []
                # Subscribe to MQTT broker
                await self.client.subscribe(topic)
                
            self.subscriptions[topic].append(callback)
            logger.debug(f"Subscribed to {topic}")
            
            return True
            
        except Exception as e:
            logger.error(f"Subscribe error on {topic}: {e}")
            return False
            
    async def unsubscribe(self, topic: str, callback: Optional[Callable] = None) -> bool:
        """Unsubscribe from topic"""
        if not self.connected or not self.client:
            return False
            
        try:
            # Add topic prefix if not present
            if not topic.startswith(self.config.topic_prefix):
                topic = f"{self.config.topic_prefix}/{topic}"
                
            if topic in self.subscriptions:
                if callback:
                    # Remove specific callback
                    self.subscriptions[topic] = [
                        cb for cb in self.subscriptions[topic] 
                        if cb != callback
                    ]
                else:
                    # Remove all callbacks
                    self.subscriptions[topic] = []
                    
                # If no callbacks left, unsubscribe from broker
                if not self.subscriptions[topic]:
                    del self.subscriptions[topic]
                    await self.client.unsubscribe(topic)
                    
            logger.debug(f"Unsubscribed from {topic}")
            return True
            
        except Exception as e:
            logger.error(f"Unsubscribe error on {topic}: {e}")
            return False
            
    # Convenience methods for common topics
    async def publish_command(self, target: str, command: str, 
                            parameters: Optional[Dict[str, Any]] = None) -> bool:
        """Publish command to target"""
        payload = {
            "command": command,
            "parameters": parameters or {},
            "timestamp": datetime.now().isoformat(),
            "source": self.config.client_id
        }
        
        return await self.publish(
            f"command/{target}",
            payload,
            qos=self.config.qos_commands
        )
        
    async def publish_telemetry(self, source: str, data: Dict[str, Any]) -> bool:
        """Publish telemetry data"""
        payload = {
            "source": source,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        return await self.publish(
            f"telemetry/{source}",
            payload,
            qos=self.config.qos_telemetry
        )
        
    async def publish_alert(self, level: str, message: str, 
                          details: Optional[Dict[str, Any]] = None) -> bool:
        """Publish alert"""
        payload = {
            "level": level,  # info, warning, critical, emergency
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat(),
            "source": self.config.client_id
        }
        
        return await self.publish(
            f"alerts/{level}",
            payload,
            qos=self.config.qos_commands,
            retain=True
        )
        
    async def request_response(self, topic: str, request: Dict[str, Any], 
                             timeout: float = 5.0) -> Optional[Any]:
        """Send request and wait for response"""
        # Generate correlation ID
        correlation_id = f"{self.config.client_id}_{datetime.now().timestamp()}"
        response_topic = f"response/{correlation_id}"
        
        # Setup response handler
        response_future = asyncio.Future()
        
        async def response_handler(topic: str, data: Any):
            response_future.set_result(data)
            
        # Subscribe to response topic
        await self.subscribe(response_topic, response_handler)
        
        # Add response topic to request
        request["response_topic"] = response_topic
        request["correlation_id"] = correlation_id
        
        # Publish request
        await self.publish(topic, request)
        
        try:
            # Wait for response
            response = await asyncio.wait_for(response_future, timeout=timeout)
            return response
            
        except asyncio.TimeoutError:
            logger.warning(f"Request timeout for {topic}")
            return None
            
        finally:
            # Unsubscribe from response topic
            await self.unsubscribe(response_topic, response_handler)
            
    def get_statistics(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            "connected": self.connected,
            "broker": f"{self.config.host}:{self.config.port}",
            "client_id": self.config.client_id,
            "subscriptions": len(self.subscriptions),
            "stats": self.stats.copy()
        }


# Example usage
async def main():
    """Example usage"""
    # Create service
    mqtt = MQTTService(host="localhost", port=1883)
    
    # Connect
    if await mqtt.connect():
        # Subscribe to topics
        async def on_command(topic: str, data: Any):
            print(f"Command received on {topic}: {data}")
            
        await mqtt.subscribe("command/printer", on_command)
        
        # Publish messages
        await mqtt.publish_command("printer", "start", {"file": "test.gcode"})
        
        await mqtt.publish_telemetry(
            "printer1",
            {
                "temperature": 205.5,
                "progress": 45.2,
                "time_remaining": 1842
            }
        )
        
        await mqtt.publish_alert(
            "warning",
            "Low filament detected",
            {"printer": "printer1", "color": "black", "remaining_m": 5.2}
        )
        
        # Wait a bit
        await asyncio.sleep(5)
        
        # Get statistics
        stats = mqtt.get_statistics()
        print(f"Statistics: {json.dumps(stats, indent=2)}")
        
        # Disconnect
        await mqtt.disconnect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())