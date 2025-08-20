"""
Enhanced Account Management API
Supports all connected account providers with data fetching capabilities
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
import httpx
import logging

from services.database_services import get_session, LinkedAccount, User
from services.auth_services import get_current_user
from services.oauth_service import get_oauth_provider, TokenEncryption

router = APIRouter(tags=["enhanced_accounts"])
logger = logging.getLogger(__name__)

# Enhanced provider configurations
PROVIDER_CONFIGS = {
    "github": {
        "api_base": "https://api.github.com",
        "data_endpoints": {
            "repos": "/user/repos",
            "issues": "/issues",
            "gists": "/gists"
        }
    },
    "google": {
        "api_base": "https://www.googleapis.com",
        "data_endpoints": {
            "drive_files": "/drive/v3/files",
            "sheets": "/sheets/v4/spreadsheets",
            "docs": "/docs/v1/documents"
        }
    },
    "linear": {
        "api_base": "https://api.linear.app",
        "data_endpoints": {
            "issues": "/graphql",
            "projects": "/graphql"
        }
    },
    "notion": {
        "api_base": "https://api.notion.com/v1",
        "data_endpoints": {
            "databases": "/databases",
            "pages": "/pages",
            "search": "/search"
        }
    },
    "jira": {
        "api_base": "https://api.atlassian.com",
        "data_endpoints": {
            "issues": "/rest/api/3/search",
            "projects": "/rest/api/3/project"
        }
    }
}

# Procurement providers (API key based)
PROCUREMENT_PROVIDERS = {
    "mcmaster": {
        "name": "McMaster-Carr",
        "auth_type": "credentials",
        "features": ["search", "cart", "orders"]
    },
    "digikey": {
        "name": "DigiKey", 
        "auth_type": "oauth2",
        "features": ["search", "inventory", "orders"]
    },
    "mouser": {
        "name": "Mouser Electronics",
        "auth_type": "api_key",
        "features": ["search", "inventory", "orders"]
    },
    "jlcpcb": {
        "name": "JLCPCB",
        "auth_type": "api_key",
        "features": ["quotes", "orders", "tracking"]
    },
    "pcbway": {
        "name": "PCBWay",
        "auth_type": "api_key", 
        "features": ["quotes", "orders", "tracking"]
    },
    "oshcut": {
        "name": "OSHCut",
        "auth_type": "api_key",
        "features": ["quotes", "orders", "files"]
    },
    "xometry": {
        "name": "Xometry",
        "auth_type": "api_key",
        "features": ["quotes", "materials", "instant_pricing"]
    },
    "protolabs": {
        "name": "Protolabs",
        "auth_type": "api_key",
        "features": ["quotes", "materials", "design_analysis"]
    }
}

# AI providers
AI_PROVIDERS = {
    "anthropic": {
        "name": "Anthropic",
        "auth_type": "api_key",
        "features": ["chat", "completion", "analysis"]
    },
    "openai": {
        "name": "OpenAI",
        "auth_type": "api_key",
        "features": ["chat", "completion", "embeddings", "images"]
    },
    "google-ai": {
        "name": "Google AI",
        "auth_type": "api_key",
        "features": ["chat", "completion", "embeddings"]
    }
}

class DataFetchRequest(BaseModel):
    data_type: str
    filters: Optional[Dict[str, Any]] = {}
    limit: Optional[int] = 100

class DataFetchResponse(BaseModel):
    provider: str
    data_type: str
    items: List[Dict[str, Any]]
    total_count: int
    fetched_at: datetime

@router.get("/providers")
async def get_available_providers():
    """Get all available providers and their capabilities"""
    oauth_providers = ["github", "google", "notion", "linear", "jira", "digikey"]
    
    return {
        "oauth_providers": oauth_providers,
        "procurement_providers": PROCUREMENT_PROVIDERS,
        "ai_providers": AI_PROVIDERS,
        "total_providers": len(oauth_providers) + len(PROCUREMENT_PROVIDERS) + len(AI_PROVIDERS)
    }

@router.post("/{account_id}/fetch-data", response_model=DataFetchResponse)
async def fetch_account_data(
    account_id: str,
    request: DataFetchRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Fetch data from any connected account"""
    # Get the linked account
    result = await db.execute(
        select(LinkedAccount).where(
            LinkedAccount.id == account_id,
            LinkedAccount.user_id == current_user["id"]
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Decrypt tokens
    token_encryption = TokenEncryption()
    access_token = token_encryption.decrypt(account.access_token)
    
    # Fetch data based on provider
    async with httpx.AsyncClient() as client:
        if account.provider == "github":
            data = await fetch_github_data(client, access_token, request.data_type, request.filters)
        elif account.provider == "google":
            data = await fetch_google_data(client, access_token, request.data_type, request.filters)
        elif account.provider == "linear":
            data = await fetch_linear_data(client, access_token, request.data_type, request.filters)
        elif account.provider == "notion":
            data = await fetch_notion_data(client, access_token, request.data_type, request.filters)
        else:
            raise HTTPException(status_code=400, detail=f"Data fetching not implemented for {account.provider}")
    
    return DataFetchResponse(
        provider=account.provider,
        data_type=request.data_type,
        items=data,
        total_count=len(data),
        fetched_at=datetime.utcnow()
    )

# GitHub data fetching
async def fetch_github_data(client: httpx.AsyncClient, token: str, data_type: str, filters: Dict):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    if data_type == "repos":
        response = await client.get(
            "https://api.github.com/user/repos",
            headers=headers,
            params={"per_page": filters.get("limit", 100), "sort": "updated"}
        )
        return response.json() if response.status_code == 200 else []
    
    elif data_type == "issues":
        response = await client.get(
            "https://api.github.com/issues",
            headers=headers,
            params={"filter": "all", "state": filters.get("state", "open")}
        )
        return response.json() if response.status_code == 200 else []
    
    elif data_type == "gists":
        response = await client.get(
            "https://api.github.com/gists",
            headers=headers
        )
        return response.json() if response.status_code == 200 else []
    
    return []

# Google data fetching
async def fetch_google_data(client: httpx.AsyncClient, token: str, data_type: str, filters: Dict):
    headers = {"Authorization": f"Bearer {token}"}
    
    if data_type == "drive_files":
        response = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={
                "pageSize": filters.get("limit", 100),
                "fields": "files(id,name,mimeType,createdTime,modifiedTime,size)"
            }
        )
        if response.status_code == 200:
            return response.json().get("files", [])
    
    elif data_type == "sheets":
        # Get all spreadsheets
        response = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={
                "q": "mimeType='application/vnd.google-apps.spreadsheet'",
                "pageSize": filters.get("limit", 50)
            }
        )
        if response.status_code == 200:
            return response.json().get("files", [])
    
    return []

# Linear data fetching
async def fetch_linear_data(client: httpx.AsyncClient, token: str, data_type: str, filters: Dict):
    headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    }
    
    if data_type == "issues":
        query = """
        query {
            issues(first: 100) {
                nodes {
                    id
                    title
                    description
                    state { name }
                    priority
                    createdAt
                    updatedAt
                }
            }
        }
        """
        
        response = await client.post(
            "https://api.linear.app/graphql",
            headers=headers,
            json={"query": query}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("issues", {}).get("nodes", [])
    
    return []

# Notion data fetching
async def fetch_notion_data(client: httpx.AsyncClient, token: str, data_type: str, filters: Dict):
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28"
    }
    
    if data_type == "databases":
        response = await client.post(
            "https://api.notion.com/v1/search",
            headers=headers,
            json={
                "filter": {"property": "object", "value": "database"},
                "page_size": filters.get("limit", 100)
            }
        )
        if response.status_code == 200:
            return response.json().get("results", [])
    
    elif data_type == "pages":
        response = await client.post(
            "https://api.notion.com/v1/search",
            headers=headers,
            json={
                "filter": {"property": "object", "value": "page"},
                "page_size": filters.get("limit", 100)
            }
        )
        if response.status_code == 200:
            return response.json().get("results", [])
    
    return []

# Procurement endpoints
@router.post("/connect-procurement/{provider}")
async def connect_procurement_account(
    provider: str,
    credentials: Dict[str, str],
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Connect a procurement account (API key or credentials based)"""
    if provider not in PROCUREMENT_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid procurement provider")
    
    provider_config = PROCUREMENT_PROVIDERS[provider]
    
    # Validate required credentials
    if provider_config["auth_type"] == "api_key" and "api_key" not in credentials:
        raise HTTPException(status_code=400, detail="API key required")
    elif provider_config["auth_type"] == "credentials":
        if "username" not in credentials or "password" not in credentials:
            raise HTTPException(status_code=400, detail="Username and password required")
    
    # Encrypt and store credentials
    token_encryption = TokenEncryption()
    encrypted_creds = token_encryption.encrypt(str(credentials))
    
    # Create linked account
    account = LinkedAccount(
        user_id=current_user["id"],
        provider=provider,
        provider_user_id=credentials.get("username", credentials.get("api_key", ""))[:255],
        access_token=encrypted_creds,
        email=credentials.get("email"),
        name=provider_config["name"],
        scopes=provider_config["features"],
        connected_at=datetime.utcnow(),
        status="active"
    )
    
    db.add(account)
    await db.commit()
    
    return {
        "id": str(account.id),
        "provider": provider,
        "name": provider_config["name"],
        "status": "connected"
    }

@router.post("/{account_id}/mcmaster/search")
async def search_mcmaster_parts(
    account_id: str,
    query: str,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Search McMaster-Carr catalog"""
    # This would integrate with McMaster's internal API or web scraping
    # For demo, return mock data
    return {
        "query": query,
        "results": [
            {
                "part_number": "91290A113",
                "name": "Socket Head Cap Screw",
                "description": "18-8 Stainless Steel, M3 x 0.5mm Thread, 10mm Long",
                "price": 5.67,
                "unit": "Pack of 50",
                "in_stock": True,
                "image_url": "/mock/image.jpg"
            }
        ],
        "total_results": 1
    }

@router.post("/{account_id}/digikey/search")
async def search_digikey_parts(
    account_id: str,
    keyword: str,
    filters: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Search DigiKey parts catalog"""
    # Would use DigiKey API
    return {
        "keyword": keyword,
        "results": [
            {
                "part_number": "296-1234-ND",
                "manufacturer_part": "LM358N",
                "description": "IC OPAMP GP 2 CIRCUIT 8DIP",
                "manufacturer": "Texas Instruments",
                "unit_price": 0.45,
                "stock": 15420,
                "datasheet_url": "/mock/datasheet.pdf"
            }
        ]
    }

@router.post("/{account_id}/jlcpcb/quote")
async def get_jlcpcb_quote(
    account_id: str,
    pcb_specs: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Get PCB manufacturing quote from JLCPCB"""
    # Would use JLCPCB API
    return {
        "specifications": pcb_specs,
        "quote": {
            "board_cost": 2.00,
            "quantity": pcb_specs.get("quantity", 5),
            "setup_fee": 0.00,
            "total": 10.00,
            "lead_time_days": 5,
            "shipping_options": [
                {"method": "DHL", "cost": 20.00, "days": 3},
                {"method": "Standard", "cost": 8.00, "days": 15}
            ]
        }
    }

# AI provider endpoints
@router.post("/connect-ai/{provider}")
async def connect_ai_provider(
    provider: str,
    api_key: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Connect an AI provider account"""
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid AI provider")
    
    provider_config = AI_PROVIDERS[provider]
    
    # Encrypt API key
    token_encryption = TokenEncryption()
    encrypted_key = token_encryption.encrypt(api_key)
    
    # Create linked account
    account = LinkedAccount(
        user_id=current_user["id"],
        provider=provider,
        provider_user_id=f"{provider}_user",
        access_token=encrypted_key,
        name=provider_config["name"],
        scopes=provider_config["features"],
        connected_at=datetime.utcnow(),
        status="active"
    )
    
    db.add(account)
    await db.commit()
    
    return {
        "id": str(account.id),
        "provider": provider,
        "name": provider_config["name"],
        "status": "connected"
    }