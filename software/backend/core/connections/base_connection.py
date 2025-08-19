# software/backend/core/connections/base_connection.py
"""
Base connection utilities for all protocol handlers
"""
import asyncio
import logging
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta

from ..machine_interface import IMachineConnection, MachineCommandResponse


class ConnectionState:
    """Track connection state and health"""
    
    def __init__(self):
        self.connected = False
        self.last_response = datetime.now()
        self.last_error: Optional[str] = None
        self.retry_count = 0
        self.total_commands = 0
        self.failed_commands = 0
        
    def mark_success(self):
        """Mark a successful communication"""
        self.last_response = datetime.now()
        self.last_error = None
        self.retry_count = 0
        self.total_commands += 1
        
    def mark_failure(self, error: str):
        """Mark a failed communication"""
        self.last_error = error
        self.retry_count += 1
        self.total_commands += 1
        self.failed_commands += 1
        
    def is_healthy(self, timeout_seconds: int = 30) -> bool:
        """Check if connection is healthy"""
        if not self.connected:
            return False
        if datetime.now() - self.last_response > timedelta(seconds=timeout_seconds):
            return False
        return True


class BaseConnection(IMachineConnection):
    """Base class with common connection functionality"""
    
    def __init__(self, connection_id: str, logger: Optional[logging.Logger] = None):
        self.connection_id = connection_id
        self.logger = logger or logging.getLogger(f"connection.{connection_id}")
        self.state = ConnectionState()
        self._lock = asyncio.Lock()
        self._response_handlers: Dict[str, Callable] = {}
        
    async def _with_retry(self, operation: Callable, max_retries: int = 3) -> Any:
        """Execute operation with retry logic"""
        last_error = None
        
        for attempt in range(max_retries):
            try:
                result = await operation()
                self.state.mark_success()
                return result
            except Exception as e:
                last_error = e
                self.state.mark_failure(str(e))
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    self.logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                    await asyncio.sleep(wait_time)
                    
        raise last_error
        
    def add_response_handler(self, pattern: str, handler: Callable):
        """Add a handler for specific response patterns"""
        self._response_handlers[pattern] = handler
        
    async def _process_response(self, response: str) -> Dict[str, Any]:
        """Process response through registered handlers"""
        for pattern, handler in self._response_handlers.items():
            if pattern in response:
                return await handler(response)
        return {"raw": response}