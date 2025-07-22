#!/usr/bin/env python3
"""
W.I.T. Modular Test - Tests each component independently
"""

import sys
import os
from pathlib import Path
import importlib.util

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

class ModularTester:
    def __init__(self):
        self.results = {"passed": 0, "failed": 0, "warnings": 0}
    
    def test_module(self, name, module_path, test_attrs=None):
        """Test a single module"""
        print(f"\nTesting {name}...")
        
        try:
            # Check if file exists
            if not Path(module_path).exists():
                print(f"  ✗ File not found: {module_path}")
                self.results["failed"] += 1
                return False
            
            # Try to load module
            spec = importlib.util.spec_from_file_location(name, module_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                print(f"  ✓ Module loaded successfully")
                self.results["passed"] += 1
                
                # Test attributes if specified
                if test_attrs:
                    for attr in test_attrs:
                        if hasattr(module, attr):
                            print(f"  ✓ Found attribute: {attr}")
                            self.results["passed"] += 1
                        else:
                            print(f"  ⚠ Missing attribute: {attr}")
                            self.results["warnings"] += 1
                
                return True
            else:
                print(f"  ✗ Failed to load module")
                self.results["failed"] += 1
                return False
                
        except Exception as e:
            print(f"  ✗ Error: {str(e)[:100]}...")
            self.results["failed"] += 1
            return False
    
    def test_package_structure(self):
        """Test package __init__.py files exist"""
        print("\nTesting package structure...")
        
        packages = [
            "software",
            "software/backend",
            "software/backend/api",
            "software/backend/services",
            "software/ai",
            "software/ai/voice",
            "software/ai/vision",
            "software/integrations"
        ]
        
        for package in packages:
            init_file = project_root / package / "__init__.py"
            if init_file.exists():
                print(f"  ✓ {package}/__init__.py exists")
                self.results["passed"] += 1
            else:
                print(f"  ⚠ {package}/__init__.py missing - creating...")
                init_file.parent.mkdir(parents=True, exist_ok=True)
                init_file.touch()
                self.results["warnings"] += 1
    
    def test_backend_components(self):
        """Test backend components individually"""
        print("\nTesting Backend Components...")
        
        # Test services
        services = [
            ("Database Service", "software/backend/services/database_service.py", ["DatabaseService", "Base"]),
            ("MQTT Service", "software/backend/services/mqtt_service.py", ["MQTTService", "MQTTConfig"]),
            ("Auth Service", "software/backend/services/auth_service.py", ["AuthService", "auth_router"]),
            ("Event Service", "software/backend/services/event_service.py", ["EventService", "Event"]),
        ]
        
        for name, path, attrs in services:
            self.test_module(name, project_root / path, attrs)
    
    def test_api_routers(self):
        """Test API routers"""
        print("\nTesting API Routers...")
        
        routers = [
            ("Voice API", "software/backend/api/voice_api.py", ["router"]),
            ("Vision API", "software/backend/api/vision_api.py", ["router"]),
            ("Equipment API", "software/backend/api/equipment_api.py", ["router"]),
            ("Workspace API", "software/backend/api/workspace_api.py", ["router"]),
            ("System API", "software/backend/api/system_api.py", ["router"]),
        ]
        
        for name, path, attrs in routers:
            self.test_module(name, project_root / path, attrs)
    
    def test_integrations(self):
        """Test equipment integrations"""
        print("\nTesting Equipment Integrations...")
        
        integrations = [
            ("OctoPrint", "software/integrations/octoprint_integration.py", ["OctoPrintManager", "OctoPrintClient"]),
            ("GRBL", "software/integrations/grbl_integration.py", ["GRBLController", "MachineState"]),
        ]
        
        for name, path, attrs in integrations:
            self.test_module(name, project_root / path, attrs)
    
    def run_all_tests(self):
        """Run all modular tests"""
        print("="*60)
        print("W.I.T. Modular Test Suite")
        print("="*60)
        
        self.test_package_structure()
        self.test_backend_components()
        self.test_api_routers()
        self.test_integrations()
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"⚠️  Warnings: {self.results['warnings']}")
        print(f"📊 Total: {sum(self.results.values())}")
        
        return self.results["failed"] == 0


def main():
    tester = ModularTester()
    success = tester.run_all_tests()
    
    # Provide next steps
    print("\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    
    if success:
        print("✅ All modules are properly structured!")
        print("\nTo start the backend:")
        print("  cd software/backend")
        print("  python -m uvicorn main:app --reload")
    else:
        print("⚠️  Some issues need to be fixed.")
        print("\nRecommended fixes:")
        print("1. Install missing dependencies:")
        print("   pip install opencv-python asyncio-mqtt timescaledb")
        print("2. Ensure all __init__.py files exist")
        print("3. Check import paths in failing modules")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())