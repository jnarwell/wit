#!/usr/bin/env python3
"""
Simple test to launch Arduino IDE
"""

import asyncio
import websockets
import json

async def launch_arduino():
    uri = "ws://localhost:8000/ws/desktop-controller"
    
    async with websockets.connect(uri) as websocket:
        # Register as a test controller
        await websocket.send(json.dumps({
            "type": "register",
            "controllerId": "test-launcher",
            "capabilities": {"test": True}
        }))
        
        # Wait for registration ack
        response = await websocket.recv()
        print(f"Registered: {response}")
        
        # Send launch command
        command = {
            "type": "plugin_command",
            "pluginId": "arduino-ide",
            "command": {
                "action": "launch",
                "payload": {}
            },
            "messageId": "launch-1"
        }
        
        print(f"\nSending launch command...")
        await websocket.send(json.dumps(command))
        
        # Wait a bit for Arduino to launch
        await asyncio.sleep(2)
        print("Arduino IDE should be launching!")
        
        # Close connection
        await websocket.close()

if __name__ == "__main__":
    asyncio.run(launch_arduino())