# software/backend/tests/test_discovery.py
"""
Test the machine discovery service
"""
import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock
from typing import List

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.discovery_service import (
    DiscoveredMachine, SerialDiscovery, OctoPrintDiscovery,
    NetworkScanDiscovery, MachineDiscoveryService, get_discovery_service
)
from core.machine_types import MachineType, ConnectionProtocol


class TestDiscoveredMachine:
    """Test discovered machine data structure"""
    
    def test_discovered_machine_creation(self):
        machine = DiscoveredMachine(
            discovery_id="test_001",
            name="Test Printer",
            machine_type=MachineType.PRINTER_3D_FDM,
            connection_protocol=ConnectionProtocol.SERIAL_GCODE,
            connection_params={"port": "/dev/ttyUSB0"},
            metadata={"vid": 0x1234}
        )
        
        assert machine.discovery_id == "test_001"
        assert machine.name == "Test Printer"
        assert machine.machine_type == MachineType.PRINTER_3D_FDM
        assert machine.connection_params["port"] == "/dev/ttyUSB0"
        
    def test_discovered_machine_hash(self):
        machine1 = DiscoveredMachine(
            discovery_id="test_001",
            name="Test",
            machine_type=MachineType.PRINTER_3D_FDM,
            connection_protocol=ConnectionProtocol.SERIAL_GCODE,
            connection_params={},
            metadata={}
        )
        machine2 = DiscoveredMachine(
            discovery_id="test_001",
            name="Different Name",
            machine_type=MachineType.PRINTER_3D_FDM,
            connection_protocol=ConnectionProtocol.SERIAL_GCODE,
            connection_params={},
            metadata={}
        )
        
        # Same discovery_id should have same hash
        assert hash(machine1) == hash(machine2)


@pytest.mark.asyncio
class TestSerialDiscovery:
    """Test serial port discovery"""
    
    @patch('serial.tools.list_ports.comports')
    async def test_discover_serial_ports(self, mock_comports):
        # Mock serial ports
        mock_port1 = Mock()
        mock_port1.device = "/dev/ttyUSB0"
        mock_port1.description = "USB Serial Device"
        mock_port1.vid = 0x2341
        mock_port1.pid = 0x0043  # Arduino Mega
        mock_port1.serial_number = "12345"
        mock_port1.manufacturer = "Arduino"
        mock_port1.product = "Mega 2560"
        
        mock_port2 = Mock()
        mock_port2.device = "/dev/ttyUSB1"
        mock_port2.description = "Random USB Device"
        mock_port2.vid = 0x1234
        mock_port2.pid = 0x5678
        mock_port2.serial_number = None
        mock_port2.manufacturer = None
        mock_port2.product = None
        
        mock_comports.return_value = [mock_port1, mock_port2]
        
        discovery = SerialDiscovery()
        machines = await discovery.discover()
        
        assert len(machines) >= 1
        
        # Check Arduino was discovered
        arduino = next((m for m in machines if "Arduino" in m.name), None)
        assert arduino is not None
        assert arduino.connection_protocol == ConnectionProtocol.SERIAL_GCODE
        assert arduino.connection_params["port"] == "/dev/ttyUSB0"
        assert arduino.metadata["vid"] == 0x2341
        
    @patch('serial.tools.list_ports.comports')
    async def test_discover_no_serial_ports(self, mock_comports):
        mock_comports.return_value = []
        
        discovery = SerialDiscovery()
        machines = await discovery.discover()
        
        assert len(machines) == 0


@pytest.mark.asyncio
class TestOctoPrintDiscovery:
    """Test OctoPrint mDNS discovery"""
    
    async def test_discover_octoprint(self):
        # For now, just test that discovery runs without error
        # Actual mDNS testing would require more complex mocking
        discovery = OctoPrintDiscovery()
        
        # Mock the internal discovery to avoid actual mDNS
        discovery._discovered.add(DiscoveredMachine(
            discovery_id="octoprint_test",
            name="Test OctoPrint",
            machine_type=MachineType.PRINTER_3D_FDM,
            connection_protocol=ConnectionProtocol.OCTOPRINT,
            connection_params={"base_url": "http://octopi.local"},
            metadata={}
        ))
        
        machines = discovery.get_discovered()
        
        assert len(machines) == 1
        assert machines[0].name == "Test OctoPrint"


@pytest.mark.asyncio
class TestNetworkScanDiscovery:
    """Test network scanning discovery"""
    
    async def test_scan_network(self):
        # Test basic functionality without actual network calls
        discovery = NetworkScanDiscovery()
        
        # Test IP range parsing
        discovery.ip_range = "192.168.1.0/24"
        ips = discovery._get_ip_addresses()
        assert len(ips) == 254  # 1-254
        assert "192.168.1.1" in ips
        assert "192.168.1.254" in ips
        
        # Test that discovery runs (even if it finds nothing)
        discovery.ip_range = "192.168.255.0/24"  # Non-existent subnet
        discovery._get_ip_addresses = lambda: []  # No IPs to check
        machines = await discovery.discover()
        assert len(machines) == 0


@pytest.mark.asyncio
class TestMachineDiscoveryService:
    """Test the main discovery service"""
    
    async def test_discovery_service_creation(self):
        service = MachineDiscoveryService()
        
        assert len(service._discovery_methods) >= 2  # Serial and OctoPrint
        assert service._discovered_machines == {}
        assert service._running == False
        
    @patch('serial.tools.list_ports.comports')
    async def test_discover_once(self, mock_comports):
        # Mock a serial port
        mock_port = Mock()
        mock_port.device = "/dev/ttyUSB0"
        mock_port.description = "3D Printer"
        mock_port.vid = 0x2341
        mock_port.pid = 0x0043
        mock_port.serial_number = "12345"
        mock_port.manufacturer = "Arduino"
        mock_port.product = "Mega"
        mock_comports.return_value = [mock_port]
        
        service = MachineDiscoveryService()
        
        # Track discovered machines
        discovered = []
        def on_discovered(machine):
            discovered.append(machine)
            
        service.add_discovery_listener(on_discovered)
        
        # Run discovery
        machines = await service.discover_once()
        
        assert len(machines) >= 1
        assert len(discovered) >= 1
        assert discovered[0].connection_protocol == ConnectionProtocol.SERIAL_GCODE
        
    async def test_continuous_discovery(self):
        service = MachineDiscoveryService()
        
        # Start continuous discovery
        await service.start_continuous_discovery(interval=1)
        assert service._running == True
        
        # Let it run briefly
        await asyncio.sleep(0.1)
        
        # Stop
        await service.stop_continuous_discovery()
        assert service._running == False
        
    def test_get_discovery_service_singleton(self):
        service1 = get_discovery_service()
        service2 = get_discovery_service()
        
        assert service1 is service2


if __name__ == "__main__":
    print("Running discovery service tests...")
    
    # Test DiscoveredMachine
    test_machine = TestDiscoveredMachine()
    test_machine.test_discovered_machine_creation()
    test_machine.test_discovered_machine_hash()
    print("✅ DiscoveredMachine tests passed")
    
    # Test SerialDiscovery
    test_serial = TestSerialDiscovery()
    asyncio.run(test_serial.test_discover_serial_ports())
    asyncio.run(test_serial.test_discover_no_serial_ports())
    print("✅ SerialDiscovery tests passed")
    
    # Test OctoPrintDiscovery
    test_octo = TestOctoPrintDiscovery()
    asyncio.run(test_octo.test_discover_octoprint())
    print("✅ OctoPrintDiscovery tests passed")
    
    # Test NetworkScanDiscovery
    test_network = TestNetworkScanDiscovery()
    asyncio.run(test_network.test_scan_network())
    print("✅ NetworkScanDiscovery tests passed")
    
    # Test MachineDiscoveryService
    test_service = TestMachineDiscoveryService()
    asyncio.run(test_service.test_discovery_service_creation())
    asyncio.run(test_service.test_discover_once())
    asyncio.run(test_service.test_continuous_discovery())
    test_service.test_get_discovery_service_singleton()
    print("✅ MachineDiscoveryService tests passed")
    
    print("\n✅ All discovery tests passed!")