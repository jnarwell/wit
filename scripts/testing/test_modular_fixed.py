#!/usr/bin/env python3
"""
W.I.T. Modular Test Suite - Fixed Version
Tests project components with better import handling
"""

import sys
import os
from pathlib import Path
import importlib
import traceback

# Setup Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)  # Set working directory

class ModularTester:
    def __init__(self):
        self.results = {"passed": 0, "failed": 0, "warnings": 0}
        
    def test_import(self, module_path, attributes=None):
        """Test importing a module and checking attributes"""
        try:
            # Convert path to module name
            module_name = module_path.replace('/', '.').replace('.py', '')
            
            # Try direct import first
            try:
                module = importlib.import_module(module_name)
            except ImportError:
                # Try with 'software.' prefix
                if not module_name.startswith('software.'):
                    module = importlib.import_module(f'software.{module_name}')
                else:
                    raise
                    
            print(f"  ✓ Module loaded successfully")
            self.results["passed"] += 1
            
            # Check attributes if specified
            if attributes:
                for attr in attributes:
                    if hasattr(module, attr):
                        print(f"  ✓ Found attribute: {attr}")
                        self.results["passed"] += 1
                    else:
                        print(f"  ✗ Missing attribute: {attr}")
                        self.results["failed"] += 1
                        
            return True
            
        except Exception as e:
            error_msg = str(e).split('\n')[0][:100]
            print(f"  ✗ Error: {error_msg}...")
            if "No module named" in str(e):
                # Extract module name
                missing = str(e).split("'")[1]
                print(f"    → Install with: pip install {missing}")
            self.results["failed"] += 1
            return False
    
    def run_tests(self):
        """Run all modular tests"""
        print("=" * 60)
        print("W.I.T. Modular Test Suite - Fixed")
        print("=" * 60)
        
        # Test package structure
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
                init_file.write_text('"""Package init"""')
                self.results["warnings"] += 1
        
        # Test core services (without AI deps)
        print("\nTesting Core Services...")
        
        print("Testing MQTT Service...")
        self.test_import("backend.services.mqtt_service", ["MQTTService", "MQTTConfig"])
        
        print("Testing Auth Service...")
        self.test_import("backend.services.auth_services", ["auth_service", "get_current_user"])
        
        # Test API routers (skip those with heavy deps)
        print("\nTesting API Routers...")
        
        print("Testing Equipment API...")
        self.test_import("backend.api.equipment_api", ["router"])
        
        print("Testing System API...")
        self.test_import("backend.api.system_api", ["router"])
        
        # Test integrations
        print("\nTesting Equipment Integrations...")
        
        if self.check_dependency("aiohttp"):
            print("Testing OctoPrint...")
            self.test_import("integrations.octoprint_integration", 
                            ["OctoPrintManager", "OctoPrintClient"])
        
        if self.check_dependency("serial"):
            print("Testing GRBL...")
            self.test_import("integrations.grbl_integration", 
                            ["GRBLController", "MachineState"])
        
        # Summary
        self.print_summary()
        
    def check_dependency(self, module_name):
        """Check if a dependency is installed"""
        try:
            importlib.import_module(module_name)
            return True
        except ImportError:
            print(f"  ⚠ Skipping tests requiring {module_name}")
            return False
            
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"⚠️  Warnings: {self.results['warnings']}")
        total = sum(self.results.values())
        print(f"📊 Total: {total}")
        print("=" * 60)
        
        if self.results['failed'] == 0:
            print("\n✅ All tests passed!")
        else:
            print("\n⚠️  Some issues need to be fixed.")
            print("Run: pip install aiohttp pyserial pydantic[email]")

if __name__ == "__main__":
    tester = ModularTester()
    tester.run_tests()
