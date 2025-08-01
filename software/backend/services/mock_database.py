"""
Mock database service for development
"""

from typing import AsyncGenerator
import uuid
from datetime import datetime

class MockSession:
    """Mock database session"""
    def __init__(self):
        self.data = {}
    
    async def execute(self, query):
        return MockResult()
    
    async def commit(self):
        pass
    
    async def rollback(self):
        pass
    
    def add(self, obj):
        pass
    
    async def flush(self):
        pass
    
    async def refresh(self, obj):
        pass

class MockResult:
    """Mock query result"""
    def scalar(self):
        return None
    
    def scalar_one_or_none(self):
        return None
    
    def scalars(self):
        return MockScalars()

class MockScalars:
    """Mock scalars result"""
    def all(self):
        return []
    
    def unique(self):
        return self

class MockUser:
    """Mock user object"""
    def __init__(self, username="admin"):
        self.id = str(uuid.uuid4())
        self.username = username
        self.email = f"{username}@example.com"
        self.disabled = False

async def get_mock_session() -> AsyncGenerator[MockSession, None]:
    """Get mock database session"""
    session = MockSession()
    try:
        yield session
    finally:
        pass

def get_mock_current_user():
    """Get mock current user"""
    return MockUser("admin")