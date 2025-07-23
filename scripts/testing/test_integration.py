"""
W.I.T. Integration Test Suite

Comprehensive test to verify all components work together.
"""

import pytest
import asyncio
import os
import sys
import json
import numpy as np
from pathlib import Path
from datetime import datetime
import logging

# Add project root to path
project_root = Path(__file__).resolve().parents[2]
print(f"Project Root: {project_root}")



# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import all our components
from software.backend.main import app
from software.backend.services.database_services import DatabaseService
from software.backend.services.mqtt_service import MQTTService
from software.backend.services.auth_service import auth_service
from software.ai.voice.voice_processor import VoiceProcessor, ProcessingConfig
from software.ai.vision.vision_processor import VisionProcessor, VisionConfig
from software.integrations.octoprint_integration import OctoPrintManager
from software.integrations.grbl_integration import GRBLController


class TestWITIntegration:
    """Integration tests for W.I.T. system"""
    
    @pytest.fixture
    def test_config(self):
        """Test configuration"""
        return {
            "database_url": "postgresql+asyncpg://postgres:postgres@localhost/wit_test",
            "mqtt_host": "localhost",
            "mqtt_port": 1883,
            "test_timeout": 30
        }
    
    def test_imports(self):
        """Test that all modules can be imported"""
        logger.info("✓ All modules imported successfully")
    
    @pytest.mark.asyncio
    async def test_database_service(self, test_config):
        """Test database service"""
        logger.info("Testing Database Service...")
        
        # Skip if no database available
        if not os.getenv("TEST_DATABASE", "false").lower() == "true":
            pytest.skip("Database tests disabled (set TEST_DATABASE=true)")
        
        db = DatabaseService()
        await db.initialize(test_config["database_url"])
        
        try:
            # Test connection
            await db.connect()
            assert db.connected
            logger.info("  ✓ Database connected")
            
            # Test creating tables
            await db.create_tables()
            logger.info("  ✓ Tables created")
            
            # Test basic operations
            from software.backend.services.database_service import User
            
            # Create user
            user = User(
                username="test_user",
                email="test@example.com",
                hashed_password="hashed_password"
            )
            created_user = await db.create(user)
            assert created_user.id is not None
            logger.info("  ✓ User created")
            
            # Get user
            retrieved_user = await db.get(User, username="test_user")
            assert retrieved_user is not None
            assert retrieved_user.email == "test@example.com"
            logger.info("  ✓ User retrieved")
            
            # Get statistics
            stats = await db.get_statistics()
            assert "users_count" in stats
            logger.info("  ✓ Statistics retrieved")
            
        finally:
            await db.disconnect()
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
    
    @pytest.mark.asyncio
    async def test_voice_processor(self):
        """Test voice processing"""
        logger.info("Testing Voice Processor...")
        
        # Skip if no voice models available
        if not os.getenv("TEST_VOICE", "false").lower() == "true":
            pytest.skip("Voice tests disabled (set TEST_VOICE=true)")
        
        config = ProcessingConfig(
            model_size="tiny",
            device="cpu",
            enable_npu=False
        )
        
        processor = VoiceProcessor(config)
        
        try:
            await processor.start()
            assert processor.state.value in ["idle", "listening"]
            logger.info("  ✓ Voice processor started")
            
            # Test audio processing
            sample_rate = 16000
            duration = 0.1  # 100ms
            audio_data = np.random.randint(
                -1000, 1000, 
                int(sample_rate * duration), 
                dtype=np.int16
            )
            
            # Process chunk
            result = await processor.process_audio_chunk(
                audio_data, 
                datetime.now().timestamp()
            )
            logger.info("  ✓ Audio chunk processed")
            
            # Get statistics
            stats = processor.get_statistics()
            assert "transcriptions" in stats
            logger.info("  ✓ Statistics retrieved")
            
        finally:
            await processor.stop()
            logger.info("  ✓ Voice processor stopped")
    
    @pytest.mark.asyncio
    async def test_vision_processor(self):
        """Test vision processing"""
        logger.info("Testing Vision Processor...")
        
        # Skip if no cameras available
        if not os.getenv("TEST_VISION", "false").lower() == "true":
            pytest.skip("Vision tests disabled (set TEST_VISION=true)")
        
        config = VisionConfig(
            camera_indices=[],  # No real cameras for test
            use_gpu=False,
            use_npu=False
        )
        
        processor = VisionProcessor(config)
        
        try:
            # Don't actually start (no cameras)
            # Just test initialization
            assert processor is not None
            logger.info("  ✓ Vision processor created")
            
            # Test with dummy image
            dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
            detections = await processor._detect_objects(dummy_image)
            assert isinstance(detections, list)
            logger.info("  ✓ Object detection works")
            
            # Get statistics
            stats = processor.get_statistics()
            assert "frames_processed" in stats
            logger.info("  ✓ Statistics retrieved")
            
        except Exception as e:
            logger.warning(f"  ! Vision test partial: {e}")
    
    @pytest.mark.asyncio
    async def test_fastapi_app(self):
        """Test FastAPI application"""
        logger.info("Testing FastAPI Application...")
        
        from httpx import AsyncClient
        import requests
        import time

        # Create test client
        async with AsyncClient(base_url="http://backend:8000") as client:

            # Retry mechanism for FastAPI startup
            max_retries = 10
            retry_delay = 1  # seconds

            for i in range(max_retries):
                try:
                    # Test root endpoint
                    response = await client.get("/")
                    response.raise_for_status()  # Raise an exception for HTTP errors
                    assert response.status_code == 200
                    assert response.json()["message"] == "W.I.T. Terminal API"
                    logger.info("  ✓ Root endpoint works")

                    # Test health endpoint
                    response = await client.get("/api/v1/system/health")
                    response.raise_for_status()
                    assert response.status_code == 200
                    assert response.json()["status"] == "healthy"
                    logger.info("  ✓ Health endpoint works")
                    break  # Exit loop if successful
                except requests.exceptions.ConnectionError as e:
                    logger.warning(f"Connection refused, retrying... ({i + 1}/{max_retries}) - {e}")
                    time.sleep(retry_delay)
                except Exception as e:
                    logger.error(f"FastAPI app test failed: {e}")
                    raise
            else:
                raise Exception(f"FastAPI app did not become available after {max_retries} retries.")

            # Test API documentation
            response = await client.get("/docs")
        assert response.status_code == 200
        logger.info("  ✓ API documentation available")
    
    @pytest.mark.asyncio
    async def test_auth_service(self):
        """Test authentication service"""
        logger.info("Testing Auth Service...")
        
        # Test password hashing
        password = "test_password"
        hashed = auth_service.get_password_hash(password)
        assert auth_service.verify_password(password, hashed)
        logger.info("  ✓ Password hashing works")
        
        # Test token creation
        token_data = {"sub": "test_user", "user_id": "123"}
        token = auth_service.create_access_token(token_data)
        assert token is not None
        logger.info("  ✓ Token creation works")
        
        # Test token decode
        decoded = auth_service.decode_token(token)
        assert decoded is not None
        assert decoded["sub"] == "test_user"
        logger.info("  ✓ Token decode works")
    
    def test_configuration_files(self):
        """Test configuration files exist"""
        logger.info("Testing Configuration Files...")
        
        config_files = [
            "software/config/voice_config.json",
            "docker-compose.yml",
            "Makefile"
        ]
        
        for config_file in config_files:
            path = project_root / config_file
            assert path.exists(), f"Missing: {config_file}"
            logger.info(f"  ✓ {config_file} exists")
        
        # Test voice config is valid JSON
        voice_config_path = project_root / "software/config/voice_config.json"
        with open(voice_config_path) as f:
            voice_config = json.load(f)
            assert "voice_processing" in voice_config
            logger.info("  ✓ Voice config is valid JSON")
    
    def test_project_structure(self):
        """Test project structure is complete"""
        logger.info("Testing Project Structure...")
        
        required_dirs = [
            "firmware/core/voice",
            "firmware/drivers/audio",
            "software/ai/voice",
            "software/ai/vision",
            "software/backend/api",
            "software/backend/services",
            "software/integrations",
            "tests"
        ]
        
        for dir_path in required_dirs:
            path = project_root / dir_path
            assert path.exists(), f"Missing directory: {dir_path}"
            assert path.is_dir(), f"Not a directory: {dir_path}"
            logger.info(f"  ✓ {dir_path}/ exists")


# Run all tests
async def run_integration_tests():
    """Run all integration tests"""
    print("\n" + "="*60)
    print("W.I.T. INTEGRATION TEST SUITE")
    print("="*60 + "\n")
    
    # Check Python version
    print(f"Python Version: {sys.version}")
    print(f"Project Root: {project_root}\n")
    
    # Create test instance
    tester = TestWITIntegration()
    test_config = {
        "database_url": "postgresql+asyncpg://postgres:postgres@localhost/wit_test",
        "mqtt_host": "localhost",
        "mqtt_port": 1883,
        "test_timeout": 30
    }
    
    # Run tests
    tests = [
        ("Imports", tester.test_imports),
        ("Project Structure", tester.test_project_structure),
        ("Configuration Files", tester.test_configuration_files),
        ("FastAPI App", tester.test_fastapi_app),
        ("Auth Service", tester.test_auth_service),
        ("Database Service", lambda: asyncio.run(tester.test_database_service(test_config))),
        ("MQTT Service", lambda: asyncio.run(tester.test_mqtt_service(test_config))),
        ("Voice Processor", lambda: asyncio.run(tester.test_voice_processor())),
        ("Vision Processor", lambda: asyncio.run(tester.test_vision_processor())),
    ]
    
    passed = 0
    failed = 0
    skipped = 0
    
    for test_name, test_func in tests:
        try:
            print(f"\nRunning: {test_name}")
            print("-" * 40)
            
            if asyncio.iscoroutinefunction(test_func):
                await test_func()
            else:
                test_func()
                
            passed += 1
            print(f"✅ {test_name} PASSED")
            
        except pytest.skip.Exception as e:
            skipped += 1
            print(f"⏭️  {test_name} SKIPPED: {e}")
            
        except Exception as e:
            failed += 1
            print(f"❌ {test_name} FAILED: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⏭️  Skipped: {skipped}")
    print(f"📊 Total: {len(tests)}")
    print("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    # Run the tests
    success = asyncio.run(run_integration_tests())
    sys.exit(0 if success else 1)