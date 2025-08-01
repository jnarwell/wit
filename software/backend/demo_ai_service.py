#!/usr/bin/env python3
"""
Direct test of AI service functionality
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ai_service import ai_service

async def test_ai_service():
    """Test the unified AI service directly"""
    print("🤖 Testing Unified AI Service\n")
    
    # Test user ID
    test_user_id = "test-user-123"
    
    # 1. Test with no configuration (should use environment variables)
    print("1. Testing with environment variables...")
    response = await ai_service.simple_query(
        user_id=test_user_id,
        query="What is 2+2?"
    )
    print(f"   Provider: {response['provider']}")
    print(f"   Model: {response['model']}")
    print(f"   Response: {response['response']}")
    print(f"   Error: {response.get('error', False)}")
    
    # 2. Test with a more complex query
    print("\n2. Testing complex query...")
    response = await ai_service.simple_query(
        user_id=test_user_id,
        query="What is the best temperature for 3D printing PLA filament?"
    )
    print(f"   Provider: {response['provider']}")
    print(f"   Response: {response['response'][:200]}...")
    
    # 3. Test with tool calling
    print("\n3. Testing with tools...")
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that can perform calculations."
        },
        {
            "role": "user",
            "content": "Calculate the square root of 144"
        }
    ]
    
    response = await ai_service.chat_completion(
        user_id=test_user_id,
        messages=messages,
        max_tokens=500
    )
    print(f"   Provider: {response['provider']}")
    print(f"   Response: {response['response']}")
    
    # 4. Test provider status
    print("\n4. Provider Status:")
    for provider, available in ai_service.providers_status.items():
        print(f"   - {provider}: {'✓ Available' if available else '✗ Not installed'}")

if __name__ == "__main__":
    asyncio.run(test_ai_service())