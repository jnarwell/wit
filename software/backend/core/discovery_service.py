# software/backend/core/discovery_service.py
"""
W.I.T. Machine Discovery Service
Automatically discover machines via serial ports, network, and mDNS
"""
import asyncio
import logging
from typing import Dict, List, Optional, Callable, Any, Set
from dataclasses import dataclass
import socket
import aiohttp
from zeroconf import ServiceBrowser, Zeroconf, ServiceInfo
import serial.tools.list_ports
import re

from .machine_types import MachineType, ConnectionProtocol
from .connections import SerialConnection


@dataclass
class DiscoveredMachine:
    """Information about a discovered machine"""
    discovery_id: str
    name: str
    machine_type: MachineType
    connection_protocol: ConnectionProtocol
    connection_params: Dict[str, Any]
    metadata: Dict[str, Any]
    
    def __hash__(self):
        return hash(self.discovery_id)


class DiscoveryMethod:
    """Base class for discovery methods"""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(self.__class__.__name__)
        self._discovered: Set[DiscoveredMachine] = set()
        
    async def discover(self) -> List[DiscoveredMachine]:
        """Perform discovery and return found machines"""
        raise NotImplementedError
        
    def get_discovered(self) -> List[DiscoveredMachine]:
        """Get previously discovered machines"""
        return list(self._discovered)


class SerialDiscovery(DiscoveryMethod):
    """Discover machines connected via serial/USB"""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        super().__init__(logger)
        # Common 3D printer USB identifiers
        self.known_devices = {
            (0x1A86, 0x7523): "CH340",  # Common Chinese clone
            (0x0403, 0x6001): "FTDI",   # FTDI chip
            (0x2341, 0x0043): "Arduino Mega 2560",
            (0x2341, 0x0042): "Arduino Mega ADK",
            (0x2341, 0x0010): "Arduino Mega",
            (0x2341, 0x003D): "Arduino Due",
            (0x1A86, 0x5523): "CH341",
            (0x0483, 0x3748): "STM32",  # STM32 Virtual COM
            (0x27B1, 0x0001): "Prusa",  # Prusa printers
        }
        
    async def discover(self) -> List[DiscoveredMachine]:
        """Discover serial ports that might have machines"""
        self._discovered.clear()
        
        ports = serial.tools.list_ports.comports()
        for port in ports:
            # Check if this looks like a 3D printer
            is_printer = False
            device_name = "Unknown Device"
            
            # Check VID/PID
            if port.vid and port.pid:
                vid_pid = (port.vid, port.pid)
                if vid_pid in self.known_devices:
                    is_printer = True
                    device_name = self.known_devices[vid_pid]
                    
            # Check description
            if port.description:
                desc_lower = port.description.lower()
                if any(keyword in desc_lower for keyword in ["printer", "arduino", "serial", "usb"]):
                    is_printer = True
                    if device_name == "Unknown Device":
                        device_name = port.description
                        
            if is_printer or port.device.startswith(("/dev/ttyUSB", "/dev/ttyACM", "COM")):
                machine = DiscoveredMachine(
                    discovery_id=f"serial_{port.device}",
                    name=f"{device_name} on {port.device}",
                    machine_type=MachineType.PRINTER_3D_FDM,
                    connection_protocol=ConnectionProtocol.SERIAL_GCODE,
                    connection_params={
                        "port": port.device,
                        "baudrate": 115200,  # Default, might need detection
                    },
                    metadata={
                        "vid": port.vid,
                        "pid": port.pid,
                        "serial_number": port.serial_number,
                        "manufacturer": port.manufacturer,
                        "product": port.product,
                        "description": port.description,
                    }
                )
                self._discovered.add(machine)
                self.logger.info(f"Discovered serial device: {machine.name}")
                
        return list(self._discovered)


class OctoPrintDiscovery(DiscoveryMethod):
    """Discover OctoPrint instances via mDNS"""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        super().__init__(logger)
        self._zeroconf: Optional[Zeroconf] = None
        self._browser: Optional[ServiceBrowser] = None
        
    async def discover(self) -> List[DiscoveredMachine]:
        """Discover OctoPrint instances on the network"""
        self._discovered.clear()
        
        # Use asyncio-compatible discovery
        discovered_services = []
        
        def on_service_state_change(zeroconf, service_type, name, state_change):
            if state_change.name == "Added":
                info = zeroconf.get_service_info(service_type, name)
                if info:
                    discovered_services.append(info)
                    
        self._zeroconf = Zeroconf()
        self._browser = ServiceBrowser(
            self._zeroconf,
            ["_octoprint._tcp.local."],
            handlers=[on_service_state_change]
        )
        
        # Wait for discovery
        await asyncio.sleep(3)
        
        # Process discovered services
        for info in discovered_services:
            if info.addresses:
                ip = socket.inet_ntoa(info.addresses[0])
                port = info.port or 80
                
                machine = DiscoveredMachine(
                    discovery_id=f"octoprint_{ip}_{port}",
                    name=info.name.replace("._octoprint._tcp.local.", ""),
                    machine_type=MachineType.PRINTER_3D_FDM,
                    connection_protocol=ConnectionProtocol.OCTOPRINT,
                    connection_params={
                        "base_url": f"http://{ip}:{port}",
                        "api_key": None,  # Will need to be configured
                    },
                    metadata={
                        "mdns_name": info.name,
                        "server": info.server,
                        "properties": info.properties,
                    }
                )
                self._discovered.add(machine)
                self.logger.info(f"Discovered OctoPrint: {machine.name} at {ip}:{port}")
                
        self.cleanup()
        return list(self._discovered)
        
    def cleanup(self):
        """Clean up mDNS resources"""
        if self._browser:
            self._browser.cancel()
        if self._zeroconf:
            self._zeroconf.close()


class NetworkScanDiscovery(DiscoveryMethod):
    """Scan network for known printer endpoints"""
    
    def __init__(self, logger: Optional[logging.Logger] = None, 
                 ip_range: Optional[str] = None):
        super().__init__(logger)
        self.ip_range = ip_range or "192.168.1.0/24"  # Default local network
        self.known_endpoints = [
            # PrusaLink
            {"port": 80, "path": "/api/version", "identifier": "prusa"},
            # Moonraker
            {"port": 7125, "path": "/server/info", "identifier": "moonraker"},
            # Duet
            {"port": 80, "path": "/rr_status", "identifier": "duet"},
            # Elegoo (might need adjustment)
            {"port": 8080, "path": "/", "identifier": "elegoo"},
        ]
        
    async def discover(self) -> List[DiscoveredMachine]:
        """Scan network for known printer endpoints"""
        self._discovered.clear()
        
        # Get IP addresses to scan
        ips = self._get_ip_addresses()
        
        # Scan with limited concurrency
        semaphore = asyncio.Semaphore(20)
        tasks = []
        
        for ip in ips:
            for endpoint in self.known_endpoints:
                task = self._check_endpoint(ip, endpoint, semaphore)
                tasks.append(task)
                
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return list(self._discovered)
        
    def _get_ip_addresses(self) -> List[str]:
        """Get list of IP addresses to scan"""
        # Simple implementation for /24 network
        if self.ip_range.endswith("/24"):
            base = self.ip_range[:-3]
            parts = base.split(".")
            ips = []
            for i in range(1, 255):
                ip = f"{parts[0]}.{parts[1]}.{parts[2]}.{i}"
                ips.append(ip)
            return ips
        return []
        
    async def _check_endpoint(self, ip: str, endpoint: Dict[str, Any], semaphore):
        """Check if an endpoint responds like a printer"""
        async with semaphore:
            url = f"http://{ip}:{endpoint['port']}{endpoint['path']}"
            
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2)) as session:
                    async with session.get(url) as response:
                        if response.status == 200:
                            text = await response.text()
                            
                            # Determine machine type based on response
                            machine_type = MachineType.PRINTER_3D_FDM
                            protocol = ConnectionProtocol.HTTP_REST
                            name = f"Network Printer at {ip}"
                            
                            if endpoint["identifier"] == "prusa" and "prusa" in text.lower():
                                protocol = ConnectionProtocol.PRUSALINK
                                name = f"PrusaLink at {ip}"
                            elif endpoint["identifier"] == "moonraker" and "moonraker" in text.lower():
                                protocol = ConnectionProtocol.MOONRAKER
                                name = f"Klipper/Moonraker at {ip}"
                                machine_type = MachineType.PRINTER_3D_COREXY
                            elif endpoint["identifier"] == "duet":
                                protocol = ConnectionProtocol.DUET_RRF
                                name = f"Duet at {ip}"
                            elif endpoint["identifier"] == "elegoo":
                                protocol = ConnectionProtocol.ELEGOO_WS
                                name = f"Elegoo at {ip}"
                                machine_type = MachineType.PRINTER_3D_SLA
                                
                            machine = DiscoveredMachine(
                                discovery_id=f"network_{ip}_{endpoint['port']}",
                                name=name,
                                machine_type=machine_type,
                                connection_protocol=protocol,
                                connection_params={
                                    "base_url": f"http://{ip}:{endpoint['port']}",
                                    "ip": ip,
                                    "port": endpoint["port"],
                                },
                                metadata={
                                    "endpoint": endpoint["path"],
                                    "response_preview": text[:200],
                                }
                            )
                            self._discovered.add(machine)
                            self.logger.info(f"Discovered {name}")
                            
            except Exception:
                # Expected for most IPs
                pass


class MachineDiscoveryService:
    """Main discovery service that coordinates all discovery methods"""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger("discovery_service")
        self._discovery_methods: List[DiscoveryMethod] = []
        self._discovered_machines: Dict[str, DiscoveredMachine] = {}
        self._discovery_listeners: List[Callable[[DiscoveredMachine], None]] = []
        self._running = False
        self._discovery_task: Optional[asyncio.Task] = None
        
        # Initialize discovery methods
        self._discovery_methods = [
            SerialDiscovery(self.logger),
            OctoPrintDiscovery(self.logger),
            # NetworkScanDiscovery(self.logger),  # Disabled by default (slow)
        ]
        
    def add_discovery_method(self, method: DiscoveryMethod):
        """Add a custom discovery method"""
        self._discovery_methods.append(method)
        
    def add_discovery_listener(self, listener: Callable[[DiscoveredMachine], None]):
        """Add listener for newly discovered machines"""
        self._discovery_listeners.append(listener)
        
    def remove_discovery_listener(self, listener: Callable[[DiscoveredMachine], None]):
        """Remove discovery listener"""
        if listener in self._discovery_listeners:
            self._discovery_listeners.remove(listener)
            
    async def discover_once(self) -> List[DiscoveredMachine]:
        """Perform one discovery cycle"""
        all_discovered = []
        
        for method in self._discovery_methods:
            try:
                self.logger.info(f"Running discovery: {method.__class__.__name__}")
                discovered = await method.discover()
                
                for machine in discovered:
                    if machine.discovery_id not in self._discovered_machines:
                        self._discovered_machines[machine.discovery_id] = machine
                        all_discovered.append(machine)
                        
                        # Notify listeners
                        for listener in self._discovery_listeners:
                            try:
                                if asyncio.iscoroutinefunction(listener):
                                    await listener(machine)
                                else:
                                    listener(machine)
                            except Exception as e:
                                self.logger.error(f"Error in discovery listener: {e}")
                                
            except Exception as e:
                self.logger.error(f"Error in {method.__class__.__name__}: {e}")
                
        return all_discovered
        
    async def start_continuous_discovery(self, interval: int = 30):
        """Start continuous discovery with specified interval"""
        if self._running:
            return
            
        self._running = True
        self._discovery_task = asyncio.create_task(self._discovery_loop(interval))
        
    async def stop_continuous_discovery(self):
        """Stop continuous discovery"""
        self._running = False
        if self._discovery_task:
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
                
    async def _discovery_loop(self, interval: int):
        """Continuous discovery loop"""
        while self._running:
            await self.discover_once()
            await asyncio.sleep(interval)
            
    def get_discovered_machines(self) -> List[DiscoveredMachine]:
        """Get all discovered machines"""
        return list(self._discovered_machines.values())
        
    def get_machine(self, discovery_id: str) -> Optional[DiscoveredMachine]:
        """Get specific discovered machine"""
        return self._discovered_machines.get(discovery_id)


# Global discovery service instance
_discovery_service: Optional[MachineDiscoveryService] = None

def get_discovery_service() -> MachineDiscoveryService:
    """Get the global discovery service instance"""
    global _discovery_service
    if _discovery_service is None:
        _discovery_service = MachineDiscoveryService()
    return _discovery_service