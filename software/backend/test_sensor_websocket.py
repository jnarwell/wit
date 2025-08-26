#!/usr/bin/env python3
"""
Test script for WIT Sensors WebSocket API
Simulates an ESP32 device sending sensor data
"""

import asyncio
import websockets
import json
import random
import time
from datetime import datetime

async def simulate_esp32_sensor():
    """Simulate an ESP32 device connecting and sending sensor data"""
    uri = "ws://localhost:8000/api/v1/sensors/ws/sensor"
    device_id = "esp32_test_01"
    
    async with websockets.connect(uri) as websocket:
        print(f"Connected to {uri}")
        
        # Send authentication
        auth_msg = {
            "type": "auth",
            "device_id": device_id,
            "token": "test_token_123"
        }
        await websocket.send(json.dumps(auth_msg))
        print(f"Sent auth: {auth_msg}")
        
        # Wait for auth response
        response = await websocket.recv()
        print(f"Auth response: {response}")
        
        # Send sensor data every 5 seconds
        while True:
            # Generate random sensor data
            sensor_data = {
                "type": "sensor_data",
                "device_id": device_id,
                "timestamp": time.time(),
                "data": {
                    "temperature": round(20 + random.uniform(-5, 5), 2),
                    "humidity": round(50 + random.uniform(-10, 10), 2),
                    "pressure": round(1013 + random.uniform(-5, 5), 2),
                    "light": round(500 + random.uniform(-100, 100), 0)
                },
                "metadata": {
                    "location": "Living Room",
                    "battery": round(80 + random.uniform(-5, 5), 1),
                    "rssi": round(-70 + random.uniform(-10, 10), 0)
                }
            }
            
            await websocket.send(json.dumps(sensor_data))
            print(f"Sent data: temp={sensor_data['data']['temperature']}°C, "
                  f"humidity={sensor_data['data']['humidity']}%")
            
            # Send status update occasionally
            if random.random() < 0.2:  # 20% chance
                status_msg = {
                    "type": "status",
                    "device_id": device_id,
                    "status": {
                        "uptime": int(time.time()),
                        "free_heap": random.randint(30000, 50000),
                        "wifi_strength": round(-70 + random.uniform(-10, 10), 0)
                    }
                }
                await websocket.send(json.dumps(status_msg))
                print(f"Sent status update")
            
            await asyncio.sleep(5)

async def simulate_ui_client():
    """Simulate a UI client subscribing to sensor data"""
    uri = "ws://localhost:8000/api/v1/sensors/ws/ui"
    
    async with websockets.connect(uri) as websocket:
        print(f"UI Client connected to {uri}")
        
        # Subscribe to sensor
        subscribe_msg = {
            "type": "subscribe",
            "sensor_ids": ["esp32_test_01"]
        }
        await websocket.send(json.dumps(subscribe_msg))
        print(f"Subscribed to sensors: {subscribe_msg['sensor_ids']}")
        
        # Listen for sensor data
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            
            if data["type"] == "sensor_data":
                print(f"UI received: sensor={data['sensor_id']}, "
                      f"temp={data['data']['data']['temperature']}°C, "
                      f"time={datetime.fromtimestamp(data['data']['timestamp']).strftime('%H:%M:%S')}")

async def main():
    """Run both sensor and UI client simulations"""
    print("Starting WIT Sensor WebSocket Test")
    print("==================================")
    print("This simulates:")
    print("1. An ESP32 device sending sensor data")
    print("2. A UI client receiving the data")
    print()
    
    # Run both simulations concurrently
    await asyncio.gather(
        simulate_esp32_sensor(),
        simulate_ui_client()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest stopped by user")