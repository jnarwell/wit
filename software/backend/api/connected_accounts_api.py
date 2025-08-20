"""
Connected Accounts API - Manages external service integrations
Handles OAuth flows, API connections, and data synchronization
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import httpx
import json
import os
from urllib.parse import urlencode

from auth.dependencies import get_current_user, get_db
from models.user import User
from schemas.connected_accounts import (
    ConnectedAccountCreate,
    ConnectedAccountResponse,
    ConnectedAccountUpdate,
    ProviderConfig,
    OAuthCallback,
    DataSyncRequest,
    DataSyncResponse
)
from services.connected_accounts_service import ConnectedAccountsService
from services.oauth_service import OAuthService

router = APIRouter(prefix="/api/connected-accounts", tags=["connected-accounts"])

# Initialize services
accounts_service = ConnectedAccountsService()
oauth_service = OAuthService()

@router.get("/providers", response_model=List[ProviderConfig])
async def get_available_providers():
    """Get list of all available integration providers"""
    return accounts_service.get_available_providers()

@router.get("/", response_model=List[ConnectedAccountResponse])
async def get_connected_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all connected accounts for current user"""
    return accounts_service.get_user_accounts(db, current_user.id)

@router.post("/connect/{provider_id}")
async def initiate_connection(
    provider_id: str,
    redirect_uri: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initiate OAuth connection flow for a provider"""
    provider = accounts_service.get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # For OAuth providers, generate authorization URL
    if provider.auth_type == "oauth2":
        auth_url, state = oauth_service.get_authorization_url(
            provider_id=provider_id,
            user_id=str(current_user.id),
            redirect_uri=redirect_uri
        )
        return {
            "auth_url": auth_url,
            "state": state,
            "provider": provider_id
        }
    
    # For API key providers, return configuration needed
    elif provider.auth_type == "api_key":
        return {
            "auth_type": "api_key",
            "required_fields": provider.required_fields,
            "provider": provider_id
        }
    
    # For username/password providers
    elif provider.auth_type == "credentials":
        return {
            "auth_type": "credentials",
            "required_fields": ["username", "password"],
            "provider": provider_id
        }

@router.post("/connect/{provider_id}/complete")
async def complete_connection(
    provider_id: str,
    auth_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete connection setup (for API key or credential-based auth)"""
    provider = accounts_service.get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Validate required fields
    if provider.auth_type == "api_key":
        if "api_key" not in auth_data:
            raise HTTPException(status_code=400, detail="API key required")
    
    # Create connected account
    account = accounts_service.create_account(
        db=db,
        user_id=current_user.id,
        provider_id=provider_id,
        auth_data=auth_data
    )
    
    # Test connection
    if accounts_service.test_connection(account):
        return {"status": "connected", "account_id": account.id}
    else:
        accounts_service.delete_account(db, account.id)
        raise HTTPException(status_code=400, detail="Failed to connect to provider")

@router.get("/callback/{provider_id}")
async def oauth_callback(
    provider_id: str,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    """Handle OAuth callback from provider"""
    # Validate state and get user_id
    user_id = oauth_service.validate_state(state)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    # Exchange code for tokens
    tokens = await oauth_service.exchange_code_for_tokens(provider_id, code)
    
    # Create connected account
    account = accounts_service.create_account(
        db=db,
        user_id=user_id,
        provider_id=provider_id,
        auth_data=tokens
    )
    
    # Return success page or redirect
    return {"status": "success", "provider": provider_id}

@router.delete("/{account_id}")
async def disconnect_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect a connected account"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    accounts_service.delete_account(db, account_id)
    return {"status": "disconnected"}

@router.post("/{account_id}/sync")
async def sync_account_data(
    account_id: str,
    sync_request: DataSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> DataSyncResponse:
    """Sync data from connected account"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Perform sync based on provider type
    result = await accounts_service.sync_data(
        account=account,
        data_types=sync_request.data_types,
        options=sync_request.options
    )
    
    return DataSyncResponse(
        account_id=account_id,
        provider=account.provider_id,
        synced_at=datetime.utcnow(),
        items_synced=result.get("items_synced", 0),
        status="success" if result.get("success") else "failed",
        errors=result.get("errors", [])
    )

# Provider-specific endpoints for data fetching

@router.get("/{account_id}/github/repos")
async def get_github_repos(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get GitHub repositories for connected account"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "github":
        raise HTTPException(status_code=400, detail="Not a GitHub account")
    
    repos = await accounts_service.fetch_github_repos(account)
    return repos

@router.get("/{account_id}/google-drive/files")
async def get_google_drive_files(
    account_id: str,
    folder_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Google Drive files for connected account"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "google":
        raise HTTPException(status_code=400, detail="Not a Google account")
    
    files = await accounts_service.fetch_google_drive_files(account, folder_id)
    return files

@router.get("/{account_id}/linear/issues")
async def get_linear_issues(
    account_id: str,
    project_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Linear issues for connected account"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "linear":
        raise HTTPException(status_code=400, detail="Not a Linear account")
    
    issues = await accounts_service.fetch_linear_issues(account, project_id)
    return issues

# Procurement provider endpoints

@router.post("/{account_id}/mcmaster/search")
async def search_mcmaster_parts(
    account_id: str,
    query: str,
    filters: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search McMaster-Carr parts catalog"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "mcmaster":
        raise HTTPException(status_code=400, detail="Not a McMaster-Carr account")
    
    results = await accounts_service.search_mcmaster(account, query, filters)
    return results

@router.get("/{account_id}/digikey/inventory")
async def get_digikey_inventory(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get DigiKey inventory and order history"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "digikey":
        raise HTTPException(status_code=400, detail="Not a DigiKey account")
    
    inventory = await accounts_service.fetch_digikey_inventory(account)
    return inventory

@router.post("/{account_id}/jlcpcb/quote")
async def get_jlcpcb_quote(
    account_id: str,
    pcb_specs: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get JLCPCB manufacturing quote"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "jlcpcb":
        raise HTTPException(status_code=400, detail="Not a JLCPCB account")
    
    quote = await accounts_service.get_jlcpcb_quote(account, pcb_specs)
    return quote

# AI provider endpoints

@router.post("/{account_id}/anthropic/complete")
async def anthropic_completion(
    account_id: str,
    prompt: str,
    max_tokens: int = 1000,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get completion from Anthropic Claude"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "anthropic":
        raise HTTPException(status_code=400, detail="Not an Anthropic account")
    
    response = await accounts_service.anthropic_complete(account, prompt, max_tokens)
    return response

@router.post("/{account_id}/openai/complete")
async def openai_completion(
    account_id: str,
    prompt: str,
    model: str = "gpt-4",
    max_tokens: int = 1000,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get completion from OpenAI"""
    account = accounts_service.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.provider_id != "openai":
        raise HTTPException(status_code=400, detail="Not an OpenAI account")
    
    response = await accounts_service.openai_complete(account, prompt, model, max_tokens)
    return response