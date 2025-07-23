import pytest
import asyncio
import os
import sys
import json
import numpy as np
from pathlib import Path
from datetime import datetime
import logging

from typing import Any

# Add project root to path
project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import all our components
from software.backend.services.database_services import DatabaseService
from software.backend.services.mqtt_service import MQTTService
from software.backend.services.auth_services import auth_service
from software.ai.voice.voice_processor import VoiceProcessor, ProcessingConfig
from software.ai.vision.vision_processor import VisionProcessor, VisionConfig
from software.backend.config import settings


class TestDebugIntegration:
    """Debug integration tests for W.I.T. system"""
    
    @pytest.fixture
    def test_config(self):
        """Test configuration"""
        return {
            "database_url": os.environ.get("DATABASE_URL"),
            "mqtt_host": "mqtt",
            "mqtt_port": 1883,
            "test_timeout": 30
        }
        logger.info(f"DB_PASSWORD in test_config: {os.environ.get('DB_PASSWORD')}")
    
    @pytest.mark.asyncio
    async def test_database_service(self, test_config):
        """Test database service"""
        logger.info("Testing Database Service...")
        
        # Skip if no database available
        if not os.getenv("TEST_DATABASE", "false").lower() == "true":
            pytest.skip("Database tests disabled (set TEST_DATABASE=true)")
        
        db = DatabaseService()
        await db.initialize(test_config["database_url"], echo=False)
        
        try:
            # Test connection
            assert db._initialized
            logger.info("  ✓ Database connected")
            
            # Test creating tables
            await db.create_tables()
            logger.info("  ✓ Tables created")
            
            # Test basic operations
            from software.backend.models.database_models_extended import User
            
            # Create user
            user = User(
                username="test_user",
                email="test@example.com",
                hashed_password="hashed_password"
            )
            async with db.get_session() as session:
                session.add(user)
                await session.commit()
                await session.refresh(user)
            assert user.id is not None
            logger.info("  ✓ User created")
            
            # Get user
            async with db.get_session() as session:
                retrieved_user = await session.query(User).filter_by(username="test_user").first()
            assert retrieved_user is not None
            assert retrieved_user.email == "test@example.com"
            logger.info("  ✓ User retrieved")
            
            # Get statistics
            stats = await db.get_statistics()
            assert "users_count" in stats
            logger.info("  ✓ Statistics retrieved")
            
        finally:
            await db.close()
            logger.info("  ✓ Database disconnected")
    
    @pytest.mark.asyncio
    async def test_mqtt_service(self, test_config):
        """Test MQTT service"""
        logger.info("Testing MQTT Service...")
        
        # Skip if no MQTT broker available
        if not os.getenv("TEST_MQTT", "false").lower() == "true":
            pytest.skip("MQTT tests disabled (set TEST_MQTT=true)")
        
        mqtt = MQTTService(
            host=test_config["mqtt_host"],
            port=test_config["mqtt_port"]
        )
        
        try:
            # Test connection
            connected = await mqtt.connect()
            assert connected
            logger.info("  ✓ MQTT connected")
            
            # Test publish/subscribe
            received_messages = []
            
            async def test_handler(topic: str, data: Any):
                received_messages.append((topic, data))
            
            # Subscribe
            await mqtt.subscribe("test/topic", test_handler)
            logger.info("  ✓ Subscribed to topic")
            
            # Publish
            test_data = {"message": "test", "timestamp": datetime.now().isoformat()}
            await mqtt.publish("test/topic", test_data)
            logger.info("  ✓ Published message")
            
            # Wait for message
            await asyncio.sleep(0.5)
            assert len(received_messages) > 0
            assert received_messages[0][1]["message"] == "test"
            logger.info("  ✓ Message received")
            
        finally:
            await mqtt.disconnect()
            logger.info("  ✓ MQTT disconnected")

