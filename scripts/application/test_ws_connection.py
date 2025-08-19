#!/usr/bin/env python3
"""Test WebSocket connection to W.I.T."""

import asyncio
import websockets
import json

async def test_connection():
    uri = "ws://localhost:8000/ws/printer-bridge/TEST123"
    
    try:
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            
            # Wait for registration acknowledgment
            message = await websocket.recv()
            data = json.loads(message)
            print(f"Received: {data}")
            
            # Send a test message
            await websocket.send(json.dumps({
                "type": "heartbeat",
                "timestamp": "2025-08-15T16:45:00"
            }))
            print("Sent heartbeat")
            
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())