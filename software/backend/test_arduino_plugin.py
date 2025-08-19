#!/usr/bin/env python3
"""
Test script for Arduino plugin communication via WebSocket
"""

import asyncio
import websockets
import json
import sys

async def test_arduino_plugin():
    uri = "ws://localhost:8000/ws/desktop-controller"
    
    async with websockets.connect(uri) as websocket:
        # Register as a test controller
        await websocket.send(json.dumps({
            "type": "register",
            "controllerId": "test-controller",
            "capabilities": {"test": True}
        }))
        
        # Wait for registration ack
        response = await websocket.recv()
        print(f"Registration response: {response}")
        
        # Test Arduino plugin commands
        commands = [
            {
                "type": "plugin_command",
                "pluginId": "arduino-ide",
                "command": {
                    "action": "launch",
                    "payload": {}
                },
                "messageId": "test-1"
            },
            {
                "type": "plugin_command",
                "pluginId": "arduino-ide",
                "command": {
                    "action": "getSketchList",
                    "payload": {}
                },
                "messageId": "test-2"
            },
            {
                "type": "plugin_command",
                "pluginId": "arduino-ide",
                "command": {
                    "action": "listPorts",
                    "payload": {}
                },
                "messageId": "test-3"
            }
        ]
        
        for cmd in commands:
            print(f"\nSending command: {cmd['command']['action']}")
            await websocket.send(json.dumps(cmd))
            
            # Wait for response
            response = await websocket.recv()
            print(f"Response: {response}")
            
            # Small delay between commands
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(test_arduino_plugin())