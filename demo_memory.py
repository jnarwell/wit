#!/usr/bin/env python3
"""
W.I.T. Memory System Demo

Shows how the memory system works with different users.
"""

import asyncio
import aiohttp
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def demo_user_session(user_name: str, commands: list):
    """Demo a user session with memory"""
    async with aiohttp.ClientSession() as session:
        print(f"\n{'='*60}")
        print(f"👤 User: {user_name}")
        print(f"{'='*60}")
        
        # Register/login user
        async with session.post(
            f"{BASE_URL}/api/v1/memory/register",
            json={"name": user_name}
        ) as resp:
            user_data = await resp.json()
            token = user_data['token']
            print(f"✅ Logged in as {user_name} (ID: {user_data['user_id'][:8]}...)")
            
        # Set auth header
        headers = {"Authorization": f"Bearer {token}"}
        
        # Process commands
        for i, command in enumerate(commands, 1):
            print(f"\n{i}. Command: '{command}'")
            
            async with session.post(
                f"{BASE_URL}/api/v1/memory/command",
                json={"command": command},
                headers=headers
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"   Intent: {result['intent']}")
                    print(f"   Response: {result['response'][:150]}...")
                    if result.get('active_project'):
                        print(f"   Project: {result['active_project']}")
                        
            await asyncio.sleep(1)  # Rate limiting
            
        # Show profile stats
        async with session.get(
            f"{BASE_URL}/api/v1/memory/profile",
            headers=headers
        ) as resp:
            if resp.status == 200:
                profile = await resp.json()
                stats = profile['stats']
                print(f"\n📊 {user_name}'s Stats:")
                print(f"   Total conversations: {stats['total_conversations']}")
                print(f"   Total projects: {stats['total_projects']}")


async def main():
    """Run the demo"""
    print("🎭 W.I.T. Memory System Demo")
    print("This shows how different users have separate memories\n")
    
    # Check server
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/api/v1/memory/test") as resp:
                data = await resp.json()
                print(f"✅ Memory system status: {data['status']}")
    except:
        print("❌ Server not running! Start with: python3 memory_server.py")
        return
        
    # Demo different users
    await demo_user_session("James", [
        "I want to start a new project for a custom keyboard",
        "Set my 3D printer to 220 degrees",
        "I prefer working in Celsius",
        "What temperature did I set earlier?",
        "Show me what I was working on"
    ])
    
    await demo_user_session("Sarah", [
        "Hi, I'm new to the workshop",
        "Can you help me learn to use the laser cutter?",
        "I prefer Fahrenheit for temperature",
        "Start a project for wooden coasters",
        "What safety equipment do I need?"
    ])
    
    await demo_user_session("James", [
        "Continue my keyboard project",
        "What temperature do I usually use?",  # Should remember Celsius preference
        "How long have I been working on this?"
    ])
    
    print("\n✅ Demo complete! Notice how:")
    print("   - Each user has separate conversation history")
    print("   - Preferences are remembered (Celsius vs Fahrenheit)")
    print("   - Projects are tracked per user")
    print("   - Context carries across sessions")


if __name__ == "__main__":
    asyncio.run(main())
