#!/usr/bin/env python3
"""
W.I.T. Backend Health Check
Comprehensive test of all backend systems
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, Any, List

# Colors for output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'


class BackendHealthChecker:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = {}
        self.token = None
        
    async def run_all_checks(self):
        """Run all health checks"""
        print(f"{BLUE}🏥 W.I.T. Backend Health Check{RESET}")
        print("=" * 50)
        
        # Check if server is running
        if not await self.check_server():
            print(f"\n{RED}❌ Server is not running at {self.base_url}{RESET}")
            print(f"Please start the server: python3 dev_server.py")
            return
            
        # Run all checks
        await self.check_api_docs()
        await self.check_authentication()
        await self.check_database()
        await self.check_project_endpoints()
        await self.check_equipment_endpoints()
        await self.check_voice_endpoints()
        await self.check_vision_endpoints()
        await self.check_mqtt_status()
        await self.check_websocket()
        await self.check_file_upload()
        
        # Print summary
        self.print_summary()
        
    async def check_server(self) -> bool:
        """Check if server is running"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/") as resp:
                    self.results["server"] = resp.status == 200
                    return resp.status == 200
        except:
            self.results["server"] = False
            return False
            
    async def check_api_docs(self):
        """Check API documentation"""
        print(f"\n{YELLOW}📚 Checking API Documentation...{RESET}")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/docs") as resp:
                    if resp.status == 200:
                        print(f"{GREEN}✓ API docs available at {self.base_url}/docs{RESET}")
                        self.results["api_docs"] = True
                    else:
                        print(f"{RED}✗ API docs not accessible{RESET}")
                        self.results["api_docs"] = False
        except Exception as e:
            print(f"{RED}✗ Error checking API docs: {e}{RESET}")
            self.results["api_docs"] = False
            
    async def check_authentication(self):
        """Check authentication system"""
        print(f"\n{YELLOW}🔐 Checking Authentication...{RESET}")
        try:
            async with aiohttp.ClientSession() as session:
                # Try to login
                data = aiohttp.FormData()
                data.add_field('username', 'admin')
                data.add_field('password', 'admin123')
                
                async with session.post(
                    f"{self.base_url}/api/v1/auth/token",
                    data=data
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        self.token = result.get("access_token")
                        print(f"{GREEN}✓ Authentication working (got token){RESET}")
                        self.results["auth"] = True
                    else:
                        print(f"{RED}✗ Authentication failed (status: {resp.status}){RESET}")
                        self.results["auth"] = False
        except Exception as e:
            print(f"{RED}✗ Authentication error: {e}{RESET}")
            self.results["auth"] = False
            
    async def check_database(self):
        """Check database connectivity"""
        print(f"\n{YELLOW}🗄️  Checking Database...{RESET}")
        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if self.token:
                    headers["Authorization"] = f"Bearer {self.token}"
                    
                async with session.get(
                    f"{self.base_url}/api/v1/system/health",
                    headers=headers
                ) as resp:
                    if resp.status == 200:
                        print(f"{GREEN}✓ Database connection healthy{RESET}")
                        self.results["database"] = True
                    else:
                        print(f"{YELLOW}⚠ Database status unknown{RESET}")
                        self.results["database"] = None
        except Exception as e:
            print(f"{RED}✗ Database check error: {e}{RESET}")
            self.results["database"] = False
            
    async def check_project_endpoints(self):
        """Check project management endpoints"""
        print(f"\n{YELLOW}📋 Checking Project Endpoints...{RESET}")
        endpoints = [
            ("GET", "/api/v1/projects", "List projects"),
            ("GET", "/api/v1/tasks", "List tasks"),
            ("GET", "/api/v1/teams", "List teams"),
            ("GET", "/api/v1/materials", "List materials")
        ]
        
        results = []
        async with aiohttp.ClientSession() as session:
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
                
            for method, endpoint, desc in endpoints:
                try:
                    async with session.request(
                        method,
                        f"{self.base_url}{endpoint}",
                        headers=headers
                    ) as resp:
                        if resp.status in [200, 201]:
                            print(f"{GREEN}  ✓ {desc}: OK{RESET}")
                            results.append(True)
                        elif resp.status == 401:
                            print(f"{YELLOW}  ⚠ {desc}: Needs auth{RESET}")
                            results.append(None)
                        else:
                            print(f"{RED}  ✗ {desc}: Failed ({resp.status}){RESET}")
                            results.append(False)
                except Exception as e:
                    print(f"{RED}  ✗ {desc}: Error - {e}{RESET}")
                    results.append(False)
                    
        self.results["project_endpoints"] = all(r for r in results if r is not None)
        
    async def check_equipment_endpoints(self):
        """Check equipment control endpoints"""
        print(f"\n{YELLOW}🔧 Checking Equipment Endpoints...{RESET}")
        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if self.token:
                    headers["Authorization"] = f"Bearer {self.token}"
                    
                async with session.get(
                    f"{self.base_url}/api/v1/equipment",
                    headers=headers
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        print(f"{GREEN}  ✓ Equipment endpoint working{RESET}")
                        if data:
                            print(f"    Found {len(data)} equipment")
                        self.results["equipment"] = True
                    else:
                        print(f"{RED}  ✗ Equipment endpoint failed{RESET}")
                        self.results["equipment"] = False
        except Exception as e:
            print(f"{RED}  ✗ Equipment check error: {e}{RESET}")
            self.results["equipment"] = False
            
    async def check_voice_endpoints(self):
        """Check voice control endpoints"""
        print(f"\n{YELLOW}🎤 Checking Voice Endpoints...{RESET}")
        
        # Check if Claude API key is configured
        api_key_configured = bool(os.getenv("ANTHROPIC_API_KEY"))
        
        if not api_key_configured:
            print(f"{YELLOW}  ⚠ Claude API key not configured{RESET}")
            print(f"    Set ANTHROPIC_API_KEY in .env file")
            
        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if self.token:
                    headers["Authorization"] = f"Bearer {self.token}"
                    
                async with session.get(
                    f"{self.base_url}/api/v1/voice/status",
                    headers=headers
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        print(f"{GREEN}  ✓ Voice API available{RESET}")
                        if data.get("api_key_configured"):
                            print(f"{GREEN}    ✓ Claude integration ready{RESET}")
                        self.results["voice"] = True
                    else:
                        print(f"{YELLOW}  ⚠ Voice API not fully configured{RESET}")
                        self.results["voice"] = None
        except Exception as e:
            print(f"{RED}  ✗ Voice check error: {e}{RESET}")
            self.results["voice"] = False
            
    async def check_vision_endpoints(self):
        """Check vision processing endpoints"""
        print(f"\n{YELLOW}👁️  Checking Vision Endpoints...{RESET}")
        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if self.token:
                    headers["Authorization"] = f"Bearer {self.token}"
                    
                async with session.get(
                    f"{self.base_url}/api/v1/vision/status",
                    headers=headers
                ) as resp:
                    if resp.status == 200:
                        print(f"{GREEN}  ✓ Vision API available{RESET}")
                        self.results["vision"] = True
                    else:
                        print(f"{YELLOW}  ⚠ Vision API not configured{RESET}")
                        self.results["vision"] = None
        except Exception as e:
            print(f"{RED}  ✗ Vision check error: {e}{RESET}")
            self.results["vision"] = False
            
    async def check_mqtt_status(self):
        """Check MQTT broker status"""
        print(f"\n{YELLOW}📡 Checking MQTT...{RESET}")
        # This would actually check MQTT connection
        # For now, just check if configuration exists
        mqtt_configured = all([
            os.getenv("MQTT_HOST"),
            os.getenv("MQTT_PORT")
        ])
        
        if mqtt_configured:
            print(f"{YELLOW}  ⚠ MQTT configured but status unknown{RESET}")
            print(f"    Start broker: docker run -d -p 1883:1883 eclipse-mosquitto")
            self.results["mqtt"] = None
        else:
            print(f"{RED}  ✗ MQTT not configured{RESET}")
            self.results["mqtt"] = False
            
    async def check_websocket(self):
        """Check WebSocket support"""
        print(f"\n{YELLOW}🔄 Checking WebSocket...{RESET}")
        # Would test actual WebSocket connection
        print(f"{YELLOW}  ⚠ WebSocket endpoint needs implementation{RESET}")
        self.results["websocket"] = None
        
    async def check_file_upload(self):
        """Check file upload capability"""
        print(f"\n{YELLOW}📁 Checking File Upload...{RESET}")
        storage_path = os.getenv("FILE_STORAGE_PATH", "storage/files")
        
        if os.path.exists(storage_path):
            print(f"{GREEN}  ✓ File storage directory exists{RESET}")
            self.results["file_upload"] = True
        else:
            print(f"{YELLOW}  ⚠ File storage directory missing: {storage_path}{RESET}")
            os.makedirs(storage_path, exist_ok=True)
            print(f"{GREEN}    ✓ Created storage directory{RESET}")
            self.results["file_upload"] = True
            
    def print_summary(self):
        """Print health check summary"""
        print(f"\n{BLUE}📊 Health Check Summary{RESET}")
        print("=" * 50)
        
        total_checks = len(self.results)
        passed = sum(1 for v in self.results.values() if v is True)
        warnings = sum(1 for v in self.results.values() if v is None)
        failed = sum(1 for v in self.results.values() if v is False)
        
        for check, status in self.results.items():
            if status is True:
                print(f"{GREEN}✓ {check.replace('_', ' ').title()}: PASS{RESET}")
            elif status is None:
                print(f"{YELLOW}⚠ {check.replace('_', ' ').title()}: WARNING{RESET}")
            else:
                print(f"{RED}✗ {check.replace('_', ' ').title()}: FAIL{RESET}")
                
        print(f"\n{BLUE}Overall Score: {passed}/{total_checks} passed, {warnings} warnings, {failed} failed{RESET}")
        
        if failed > 0:
            print(f"\n{RED}⚠️  Some checks failed. Please review the issues above.{RESET}")
        elif warnings > 0:
            print(f"\n{YELLOW}⚠️  Backend is functional but some features need configuration.{RESET}")
        else:
            print(f"\n{GREEN}✅ Backend is fully operational!{RESET}")
            
        print(f"\n{BLUE}Next Steps:{RESET}")
        if not self.results.get("auth"):
            print("1. Ensure database is initialized: python3 final_db_init.py")
        if not self.results.get("mqtt"):
            print("2. Start MQTT broker: docker run -d -p 1883:1883 eclipse-mosquitto")
        if not self.results.get("voice"):
            print("3. Add ANTHROPIC_API_KEY to .env for voice features")
        print("4. Start frontend development!")


async def main():
    """Run health check"""
    checker = BackendHealthChecker()
    await checker.run_all_checks()


if __name__ == "__main__":
    asyncio.run(main())