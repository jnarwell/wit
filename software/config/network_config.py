"""
W.I.T. Network Configuration
Controls how the system communicates locally and with internet
"""
from enum import Enum
from typing import List, Dict, Any
import ipaddress

class NetworkMode(Enum):
    LOCAL_ONLY = "local_only"      # Hubs can only talk to Terminal
    HYBRID = "hybrid"               # Terminal can access internet
    DEVELOPMENT = "development"     # All connections allowed

class NetworkConfig:
    def __init__(self, mode: NetworkMode = NetworkMode.HYBRID):
        self.mode = mode
        
        # Local network ranges (private IPs)
        self.local_networks = [
            ipaddress.ip_network("192.168.0.0/16"),
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
        ]
        
        # Allowed internet services (whitelist)
        self.allowed_internet_services = [
            "octoprint.org",          # 3D printer services
            "api.openai.com",         # AI services
            "github.com",             # Updates
            "*.googleapis.com",       # Google services
            "duckduckgo.com",         # Search
        ]
        
        # Hub discovery settings
        self.hub_discovery = {
            "multicast_group": "239.255.255.250",  # mDNS
            "port": 5353,
            "service_type": "_wit._tcp.local.",
        }
        
    def is_local_ip(self, ip: str) -> bool:
        """Check if IP is on local network"""
        try:
            addr = ipaddress.ip_address(ip)
            return any(addr in network for network in self.local_networks)
        except:
            return False
            
    def can_connect_to_internet(self, service: str) -> bool:
        """Check if internet connection is allowed"""
        if self.mode == NetworkMode.LOCAL_ONLY:
            return False
        if self.mode == NetworkMode.DEVELOPMENT:
            return True
        # Check whitelist for hybrid mode
        return any(
            service.endswith(allowed) or allowed.startswith("*") and service.endswith(allowed[1:])
            for allowed in self.allowed_internet_services
        )
