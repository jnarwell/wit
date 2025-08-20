"""
Enhanced Account Management API
Supports all connected account providers with data fetching capabilities
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
import logging

# Simplified for dev server - removed database dependencies

router = APIRouter(tags=["enhanced_accounts"])
logger = logging.getLogger(__name__)

# Import the shared connected accounts store from simple accounts API
# This allows both APIs to share the same in-memory storage
from .accounts_api_simple import connected_accounts_store

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

# Removed separate AIProviderRequest model to match procurement pattern

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
    request: DataFetchRequest
):
    """Fetch data from any connected account"""
    # For dev server, return mock data
    return DataFetchResponse(
        provider="mock-provider",
        data_type=request.data_type,
        items=[{"id": "1", "name": "Mock data item", "type": request.data_type}],
        total_count=1,
        fetched_at=datetime.now(timezone.utc)
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
    credentials: Dict[str, str]
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
    
    # For dev server, store in memory and return success
    # In production, this would encrypt and store credentials in database
    account_data = {
        "id": f"dev-{provider}-account",
        "provider": provider,
        "provider_user_id": credentials.get("username", credentials.get("api_key", "")[:10] + "..."),
        "email": credentials.get("email"),
        "name": provider_config["name"],
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "last_sync": None,
        "scopes": provider_config["features"],
        "status": "connected"
    }
    
    # Store in our in-memory store (using "admin" as default username for dev)
    username = "admin"  # Default dev user
    if username not in connected_accounts_store:
        connected_accounts_store[username] = []
    
    # Check if account already exists, if so update it
    existing_account = next((acc for acc in connected_accounts_store[username] if acc["provider"] == provider), None)
    if existing_account:
        existing_account.update(account_data)
    else:
        connected_accounts_store[username].append(account_data)
    
    logger.info(f"Successfully connected {provider} account for development")
    
    return {
        "id": account_data["id"],
        "provider": provider,
        "name": provider_config["name"],
        "status": "connected"
    }

@router.post("/{account_id}/mcmaster/search")
async def search_mcmaster_parts(
    account_id: str,
    query: str,
    category: Optional[str] = None
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
    filters: Optional[Dict[str, Any]] = None
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
    pcb_specs: Dict[str, Any]
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
    credentials: Dict[str, str]
):
    """Connect an AI provider account"""
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid AI provider")
    
    # Extract API key from credentials
    api_key = credentials.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")
    
    provider_config = AI_PROVIDERS[provider]
    
    # For dev server, store in memory and return success
    # In production, this would encrypt and store the API key in database
    account_data = {
        "id": f"dev-{provider}-ai-account",
        "provider": provider,
        "provider_user_id": f"{provider}_user",
        "email": None,
        "name": provider_config["name"],
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "last_sync": None,
        "scopes": provider_config["features"],
        "status": "connected"
    }
    
    # Store in our in-memory store (using "admin" as default username for dev)
    username = "admin"  # Default dev user
    if username not in connected_accounts_store:
        connected_accounts_store[username] = []
    
    # Check if account already exists, if so update it
    existing_account = next((acc for acc in connected_accounts_store[username] if acc["provider"] == provider), None)
    if existing_account:
        existing_account.update(account_data)
    else:
        connected_accounts_store[username].append(account_data)
    
    logger.info(f"Successfully connected {provider} AI provider for development")
    
    return {
        "id": account_data["id"],
        "provider": provider,
        "name": provider_config["name"],
        "status": "connected"
    }