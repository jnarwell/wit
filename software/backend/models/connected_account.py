"""
Connected Account model for storing external service integrations
"""

from sqlalchemy import Column, String, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from database.database import Base

class ConnectedAccount(Base):
    __tablename__ = "connected_accounts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    provider_id = Column(String, nullable=False)  # github, linear, mcmaster, etc.
    
    # Encrypted credentials (OAuth tokens, API keys, etc.)
    encrypted_credentials = Column(Text, nullable=False)
    
    # Account metadata
    provider_account_id = Column(String)  # ID in the external system
    provider_account_name = Column(String)  # Username/email in external system
    
    # Settings and preferences
    settings = Column(JSON, default=dict)
    
    # Status
    is_active = Column(Boolean, default=True)
    last_synced = Column(DateTime)
    last_error = Column(String)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="connected_accounts")
    
    def __repr__(self):
        return f"<ConnectedAccount {self.provider_id} for user {self.user_id}>"