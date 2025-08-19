# software/backend/core/connections/http_connection.py
"""
HTTP/REST API connection handler for network-enabled machines
Supports OctoPrint, PrusaLink, and generic HTTP APIs
"""
import asyncio
import aiohttp
from typing import Optional, Dict, Any, List
import json
from urllib.parse import urljoin

from .base_connection import BaseConnection
from ..machine_interface import MachineCommandResponse


class HTTPConnection(BaseConnection):
    """Handle HTTP/REST API connections for machines"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None,
                 connection_id: Optional[str] = None, timeout: int = 30):
        super().__init__(connection_id or f"http_{base_url}")
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: Optional[aiohttp.ClientSession] = None
        self._headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if api_key:
            self._headers["X-Api-Key"] = api_key
            
    async def connect(self) -> bool:
        """Establish HTTP connection (create session and verify API)"""
        try:
            self._session = aiohttp.ClientSession(
                timeout=self.timeout,
                headers=self._headers
            )
            
            # Test connection with a simple API call
            test_response = await self._request("GET", "/api/version")
            if test_response:
                self.state.connected = True
                self.logger.info(f"Connected to {self.base_url}")
                return True
            else:
                await self.disconnect()
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to connect to {self.base_url}: {e}")
            self.state.mark_failure(str(e))
            return False
            
    async def disconnect(self) -> bool:
        """Close HTTP session"""
        try:
            if self._session:
                await self._session.close()
                
            self.state.connected = False
            self.logger.info(f"Disconnected from {self.base_url}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error disconnecting: {e}")
            return False
            
    async def is_connected(self) -> bool:
        """Check if HTTP connection is available"""
        return self._session is not None and not self._session.closed and self.state.is_healthy()
        
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> MachineCommandResponse:
        """Send HTTP request as command"""
        if not await self.is_connected():
            return MachineCommandResponse.error("Not connected", "CONNECTION_ERROR")
            
        # Parse command format: "METHOD /path" or just "/path" (assumes GET)
        parts = command.split(' ', 1)
        if len(parts) == 2:
            method, path = parts
        else:
            method, path = "GET", parts[0]
            
        try:
            data = await self._request(method, path, params)
            if data is not None:
                return MachineCommandResponse.success(data)
            else:
                return MachineCommandResponse.error("Request failed", "REQUEST_ERROR")
                
        except Exception as e:
            self.logger.error(f"Error sending command: {e}")
            self.state.mark_failure(str(e))
            return MachineCommandResponse.error(str(e), "SEND_ERROR")
            
    async def _request(self, method: str, path: str, data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Make HTTP request"""
        if not self._session:
            return None
            
        url = urljoin(self.base_url, path)
        
        try:
            async with self._lock:
                self.logger.debug(f"{method} {url}")
                
                kwargs = {}
                if method in ["POST", "PUT", "PATCH"] and data:
                    kwargs["json"] = data
                elif method == "GET" and data:
                    kwargs["params"] = data
                    
                async with self._session.request(method, url, **kwargs) as response:
                    response_text = await response.text()
                    
                    if response.status >= 200 and response.status < 300:
                        self.state.mark_success()
                        try:
                            return json.loads(response_text) if response_text else {}
                        except json.JSONDecodeError:
                            return {"text": response_text}
                    else:
                        self.state.mark_failure(f"HTTP {response.status}")
                        self.logger.error(f"HTTP error {response.status}: {response_text}")
                        return None
                        
        except asyncio.TimeoutError:
            self.state.mark_failure("Request timeout")
            self.logger.error("Request timeout")
            return None
        except Exception as e:
            self.state.mark_failure(str(e))
            self.logger.error(f"Request error: {e}")
            return None


class OctoPrintConnection(HTTPConnection):
    """Specialized connection for OctoPrint API"""
    
    def __init__(self, base_url: str, api_key: str):
        super().__init__(base_url, api_key, "octoprint")
        
    async def connect(self) -> bool:
        """Connect and verify OctoPrint API"""
        if await super().connect():
            # Get OctoPrint specific info
            info = await self._request("GET", "/api/server")
            if info:
                self.logger.info(f"Connected to OctoPrint {info.get('version', 'unknown')}")
                return True
        return False
        
    async def get_printer_state(self) -> Dict[str, Any]:
        """Get current printer state"""
        return await self._request("GET", "/api/printer") or {}
        
    async def get_job_info(self) -> Dict[str, Any]:
        """Get current job information"""
        return await self._request("GET", "/api/job") or {}
        
    async def start_job(self, filename: str) -> bool:
        """Start printing a file"""
        data = {"command": "select", "print": True}
        result = await self._request("POST", f"/api/files/local/{filename}", data)
        return result is not None
        
    async def pause_job(self) -> bool:
        """Pause current job"""
        data = {"command": "pause", "action": "pause"}
        result = await self._request("POST", "/api/job", data)
        return result is not None
        
    async def resume_job(self) -> bool:
        """Resume paused job"""
        data = {"command": "pause", "action": "resume"}
        result = await self._request("POST", "/api/job", data)
        return result is not None
        
    async def cancel_job(self) -> bool:
        """Cancel current job"""
        data = {"command": "cancel"}
        result = await self._request("POST", "/api/job", data)
        return result is not None


class PrusaLinkConnection(HTTPConnection):
    """Specialized connection for PrusaLink API"""
    
    def __init__(self, base_url: str, api_key: str):
        super().__init__(base_url, api_key, "prusalink")
        # PrusaLink uses different header
        self._headers["X-Api-Key"] = api_key
        
    async def connect(self) -> bool:
        """Connect and verify PrusaLink API"""
        # PrusaLink uses digest auth, might need special handling
        try:
            self._session = aiohttp.ClientSession(
                timeout=self.timeout,
                auth=aiohttp.BasicAuth("maker", self.api_key)
            )
            
            # Test with PrusaLink API
            test_response = await self._request("GET", "/api/printer")
            if test_response:
                self.state.connected = True
                self.logger.info(f"Connected to PrusaLink at {self.base_url}")
                return True
            else:
                await self.disconnect()
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to connect to PrusaLink: {e}")
            self.state.mark_failure(str(e))
            return False
            
    async def get_printer_state(self) -> Dict[str, Any]:
        """Get current printer state"""
        return await self._request("GET", "/api/printer") or {}
        
    async def get_job_info(self) -> Dict[str, Any]:
        """Get current job information"""
        return await self._request("GET", "/api/job") or {}