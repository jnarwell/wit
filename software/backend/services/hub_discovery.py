"""
W.I.T. Hub Discovery Service
Automatically finds and manages W.I.T. hubs on local network
"""
import asyncio
import socket
import json
import logging
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
import aiohttp
from zeroconf import ServiceBrowser, Zeroconf, ServiceInfo

logger = logging.getLogger(__name__)

@dataclass
class WITHub:
    """Represents a W.I.T. hub device on the network"""
    hub_id: str
    name: str
    ip_address: str
    port: int
    device_type: str  # printer, cnc, sensor_array, etc.
    capabilities: List[str]
    last_seen: datetime
    status: str = "online"
    
class HubDiscoveryService:
    """Discovers and manages W.I.T. hubs on local network"""
    
    def __init__(self):
        self.hubs: Dict[str, WITHub] = {}
        self.zeroconf = None
        self.browser = None
        self.callbacks: List[Callable] = []
        
    async def start(self):
        """Start hub discovery"""
        logger.info("Starting hub discovery service...")
        
        # Start mDNS/Bonjour discovery
        self.zeroconf = Zeroconf()
        self.browser = ServiceBrowser(
            self.zeroconf,
            "_wit._tcp.local.",
            handlers=[self._on_service_state_change]
        )
        
        # Also do active scanning
        asyncio.create_task(self._active_scan_loop())
        
    async def stop(self):
        """Stop hub discovery"""
        if self.browser:
            self.browser.cancel()
        if self.zeroconf:
            self.zeroconf.close()
            
    def _on_service_state_change(self, zeroconf, service_type, name, state_change):
        """Handle mDNS service discovery"""
        info = zeroconf.get_service_info(service_type, name)
        if info:
            # Found a W.I.T. hub
            hub = WITHub(
                hub_id=info.properties.get(b'id', b'').decode('utf-8'),
                name=info.properties.get(b'name', name).decode('utf-8'),
                ip_address=socket.inet_ntoa(info.addresses[0]),
                port=info.port,
                device_type=info.properties.get(b'type', b'unknown').decode('utf-8'),
                capabilities=json.loads(info.properties.get(b'caps', b'[]').decode('utf-8')),
                last_seen=datetime.now()
            )
            
            self.hubs[hub.hub_id] = hub
            logger.info(f"Discovered W.I.T. hub: {hub.name} at {hub.ip_address}")
            
            # Notify callbacks
            for callback in self.callbacks:
                asyncio.create_task(callback(hub))
                
    async def _active_scan_loop(self):
        """Actively scan for hubs that don't support mDNS"""
        while True:
            try:
                # Scan common ports on local network
                # This is a simplified version - real implementation would be more sophisticated
                await self._scan_network()
                await asyncio.sleep(60)  # Scan every minute
            except Exception as e:
                logger.error(f"Active scan error: {e}")
                await asyncio.sleep(5)
                
    async def _scan_network(self):
        """Scan local network for W.I.T. devices"""
        # Get local subnet
        import netifaces
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr in addrs[netifaces.AF_INET]:
                    if addr['addr'].startswith(('192.168', '10.', '172.')):
                        # Found local network interface
                        await self._scan_subnet(addr['addr'])
                        
    async def _scan_subnet(self, local_ip: str):
        """Scan a subnet for W.I.T. devices"""
        # Simple implementation - would be more sophisticated in production
        pass
        
    def register_callback(self, callback: Callable):
        """Register callback for hub discovery"""
        self.callbacks.append(callback)
        
    def get_hubs(self) -> List[WITHub]:
        """Get all discovered hubs"""
        # Remove offline hubs
        cutoff = datetime.now() - timedelta(minutes=5)
        self.hubs = {
            hub_id: hub for hub_id, hub in self.hubs.items()
            if hub.last_seen > cutoff
        }
        return list(self.hubs.values())
        
    async def send_command_to_hub(self, hub_id: str, command: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Send command to a specific hub"""
        hub = self.hubs.get(hub_id)
        if not hub:
            logger.error(f"Hub {hub_id} not found")
            return None
            
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"http://{hub.ip_address}:{hub.port}/api/command",
                    json=command,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return await response.json()
        except Exception as e:
            logger.error(f"Failed to send command to hub {hub_id}: {e}")
            return None
