"""
MQTT Service Tests
"""
import asyncio
import pytest
from datetime import datetime

from services.mqtt_service_v2 import MQTTService


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
