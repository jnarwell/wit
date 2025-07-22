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
