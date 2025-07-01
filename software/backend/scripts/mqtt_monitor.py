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
