"""
OAuth Callback Handlers
Handles OAuth callbacks for various providers
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
import uuid

import os
from services.database_services import get_session, LinkedAccount, User
from services.oauth_service import get_oauth_provider, TokenEncryption
from api.accounts_api import oauth_states

router = APIRouter(prefix="/api/v1/auth", tags=["oauth"])
logger = logging.getLogger(__name__)

@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_session)
):
    """Handle Google OAuth callback"""
    return await handle_oauth_callback("google", code, state, db)

@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_session)
):
    """Handle GitHub OAuth callback"""
    return await handle_oauth_callback("github", code, state, db)

async def handle_oauth_callback(
    provider: str,
    code: str,
    state: str,
    db: AsyncSession
):
    """Common OAuth callback handler"""
    logger.info(f"OAuth callback for {provider} - code: {code[:10]}..., state: {state[:10]}...")
    
    # Verify state
    state_data = oauth_states.get(state)
    if not state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired state"
        )
    
    # Clean up state
    del oauth_states[state]
    
    user_id = state_data["user_id"]
    
    try:
        # Get OAuth provider
        logger.info(f"Getting OAuth provider for {provider}")
        oauth_provider = get_oauth_provider(provider)
        
        # Exchange code for tokens
        logger.info(f"Exchanging code for tokens")
        token_data = await oauth_provider.exchange_code_for_token(code)
        logger.info(f"Token exchange successful")
        
        # Get user info from provider
        user_info = await oauth_provider.get_user_info(token_data["access_token"])
        
        # Check if this account is already linked
        existing = await db.execute(
            select(LinkedAccount).where(
                LinkedAccount.user_id == uuid.UUID(user_id),
                LinkedAccount.provider == provider,
                LinkedAccount.provider_user_id == str(user_info.get("id", user_info.get("sub")))
            )
        )
        linked_account = existing.scalar_one_or_none()
        
        if linked_account:
            # Update existing linked account
            linked_account.access_token = TokenEncryption.encrypt(token_data["access_token"])
            if "refresh_token" in token_data:
                linked_account.refresh_token = TokenEncryption.encrypt(token_data["refresh_token"])
            linked_account.updated_at = datetime.utcnow()
            linked_account.status = "connected"
        else:
            # Create new linked account
            linked_account = LinkedAccount(
                user_id=uuid.UUID(user_id),
                provider=provider,
                provider_user_id=str(user_info.get("id", user_info.get("sub"))),
                email=user_info.get("email"),
                name=user_info.get("name"),
                access_token=TokenEncryption.encrypt(token_data["access_token"]),
                refresh_token=TokenEncryption.encrypt(token_data.get("refresh_token", "")),
                token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
                scopes=state_data.get("scopes", []),
                provider_data=user_info,
                status="connected"
            )
            db.add(linked_account)
        
        await db.commit()
        
        logger.info(f"Successfully linked {provider} account for user {user_id}")
        logger.info(f"Linked account ID: {linked_account.id}")
        
        # Redirect to frontend with success
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        # The frontend app uses query params for navigation
        return RedirectResponse(
            url=f"{frontend_url}/?page=settings&linked={provider}&status=success"
        )
        
    except Exception as e:
        logger.error(f"Failed to link {provider} account: {e}")
        # Redirect to frontend with error
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(
            url=f"{frontend_url}/?page=settings&linked={provider}&status=error&message={str(e)}"
        )