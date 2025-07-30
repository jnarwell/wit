"""
Account Management API
Handles linked accounts, OAuth connections, and provider integrations
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
import secrets
import logging
import uuid

from services.database_services import get_session, LinkedAccount, User
from services.auth_services import get_current_user
from services.oauth_service import get_oauth_provider, TokenEncryption

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])
logger = logging.getLogger(__name__)

# Pydantic models
class LinkedAccountResponse(BaseModel):
    id: str
    provider: str
    provider_user_id: str
    email: Optional[str]
    name: Optional[str]
    connected_at: datetime
    last_sync: Optional[datetime]
    scopes: List[str]
    status: str

    class Config:
        from_attributes = True

class LinkAccountRequest(BaseModel):
    provider: str

class LinkAccountResponse(BaseModel):
    auth_url: str
    state: str

# Temporary OAuth state storage (use Redis in production)
oauth_states = {}

@router.get("/linked", response_model=List[LinkedAccountResponse])
async def get_linked_accounts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Get all linked accounts for the current user"""
    result = await db.execute(
        select(LinkedAccount).where(LinkedAccount.user_id == uuid.UUID(current_user['id']))
    )
    accounts = result.scalars().all()
    
    return [
        LinkedAccountResponse(
            id=str(account.id),
            provider=account.provider,
            provider_user_id=account.provider_user_id,
            email=account.email,
            name=account.name,
            connected_at=account.created_at,
            last_sync=account.last_sync,
            scopes=account.scopes or [],
            status=account.status
        )
        for account in accounts
    ]

@router.post("/link/{provider}", response_model=LinkAccountResponse)
async def link_account(
    provider: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Initiate OAuth flow for linking an account"""
    supported_providers = ["google", "github", "notion", "microsoft", "apple", "aws", "jira", "linear"]
    
    if provider not in supported_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' is not supported"
        )
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "user_id": str(current_user['id']),
        "provider": provider,
        "created_at": datetime.utcnow()
    }
    
    # Get OAuth provider and generate auth URL
    try:
        oauth_provider = get_oauth_provider(provider)
        auth_url = oauth_provider.get_authorization_url(state)
    except ValueError:
        # Provider not implemented yet, return placeholder
        auth_url = f"http://localhost:8000/api/v1/auth/{provider}/callback?state={state}"
        logger.warning(f"OAuth provider '{provider}' not implemented yet")
    
    return LinkAccountResponse(
        auth_url=auth_url,
        state=state
    )

@router.delete("/unlink/{provider}")
async def unlink_account(
    provider: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Unlink a connected account"""
    result = await db.execute(
        select(LinkedAccount).where(
            LinkedAccount.user_id == uuid.UUID(current_user['id']),
            LinkedAccount.provider == provider
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} account linked"
        )
    
    await db.delete(account)
    await db.commit()
    
    logger.info(f"Unlinked {provider} account for user {current_user['username']}")
    
    return {"message": f"{provider} account unlinked successfully"}

@router.post("/refresh/{provider}")
async def refresh_provider_token(
    provider: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Refresh OAuth tokens for a provider"""
    result = await db.execute(
        select(LinkedAccount).where(
            LinkedAccount.user_id == uuid.UUID(current_user['id']),
            LinkedAccount.provider == provider
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} account linked"
        )
    
    # TODO: Implement actual token refresh logic for each provider
    # For now, just update the status
    account.status = "refreshing"
    await db.commit()
    
    # In background, refresh the token
    # background_tasks.add_task(refresh_oauth_token, account)
    
    return {"message": f"Token refresh initiated for {provider}"}

# OAuth callback endpoints would go here
# These would handle the actual OAuth flow completion