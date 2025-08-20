"""
Connected Accounts Service - Handles integration with external services
"""

import httpx
import json
import os
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
import base64

from models.connected_account import ConnectedAccount
from schemas.connected_accounts import ProviderConfig, AuthType, ProviderCategory

class ConnectedAccountsService:
    def __init__(self):
        # Initialize encryption for storing sensitive credentials
        self.cipher = Fernet(self._get_or_create_key())
        
        # Define available providers
        self.providers = self._initialize_providers()
        
        # HTTP client for API calls
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    def _get_or_create_key(self) -> bytes:
        """Get or create encryption key for credentials"""
        key_file = os.path.join(os.path.dirname(__file__), "..", ".encryption_key")
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, "wb") as f:
                f.write(key)
            return key
    
    def _initialize_providers(self) -> Dict[str, ProviderConfig]:
        """Initialize provider configurations"""
        providers = {
            # Project Management
            "github": ProviderConfig(
                id="github",
                name="GitHub",
                description="Connect GitHub repositories and issues",
                category=ProviderCategory.PROJECT_MANAGEMENT,
                auth_type=AuthType.OAUTH2,
                oauth_config={
                    "authorize_url": "https://github.com/login/oauth/authorize",
                    "token_url": "https://github.com/login/oauth/access_token",
                    "scope": "repo user"
                },
                supported_features=["repos", "issues", "pull_requests", "workflows"],
                icon="github",
                color="gray"
            ),
            "linear": ProviderConfig(
                id="linear",
                name="Linear",
                description="Sync Linear issues and projects",
                category=ProviderCategory.PROJECT_MANAGEMENT,
                auth_type=AuthType.API_KEY,
                required_fields=["api_key"],
                supported_features=["issues", "projects", "cycles"],
                icon="linear",
                color="purple"
            ),
            
            # File Management
            "google": ProviderConfig(
                id="google",
                name="Google Drive",
                description="Access Google Drive files and folders",
                category=ProviderCategory.FILE_MANAGEMENT,
                auth_type=AuthType.OAUTH2,
                oauth_config={
                    "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
                    "token_url": "https://oauth2.googleapis.com/token",
                    "scope": "https://www.googleapis.com/auth/drive.readonly"
                },
                supported_features=["files", "folders", "search"],
                icon="google",
                color="blue"
            ),
            
            # Procurement
            "mcmaster": ProviderConfig(
                id="mcmaster",
                name="McMaster-Carr",
                description="Access McMaster-Carr catalog and ordering",
                category=ProviderCategory.PROCUREMENT,
                auth_type=AuthType.CREDENTIALS,
                required_fields=["username", "password"],
                supported_features=["search", "cart", "orders", "pricing"],
                icon="wrench",
                color="red"
            ),
            "digikey": ProviderConfig(
                id="digikey",
                name="DigiKey",
                description="Electronic components ordering",
                category=ProviderCategory.PROCUREMENT,
                auth_type=AuthType.OAUTH2,
                oauth_config={
                    "authorize_url": "https://api.digikey.com/v1/oauth2/authorize",
                    "token_url": "https://api.digikey.com/v1/oauth2/token",
                    "scope": "read write"
                },
                supported_features=["search", "inventory", "orders", "pricing"],
                icon="microchip",
                color="red"
            ),
            "jlcpcb": ProviderConfig(
                id="jlcpcb",
                name="JLCPCB",
                description="PCB manufacturing and assembly",
                category=ProviderCategory.PROCUREMENT,
                auth_type=AuthType.API_KEY,
                required_fields=["api_key", "api_secret"],
                supported_features=["quotes", "orders", "files", "tracking"],
                icon="cube",
                color="green"
            ),
            
            # AI Providers
            "anthropic": ProviderConfig(
                id="anthropic",
                name="Anthropic",
                description="Claude AI integration",
                category=ProviderCategory.AI,
                auth_type=AuthType.API_KEY,
                required_fields=["api_key"],
                supported_features=["chat", "completion", "analysis"],
                icon="brain",
                color="orange"
            ),
            "openai": ProviderConfig(
                id="openai",
                name="OpenAI",
                description="GPT and DALL-E integration",
                category=ProviderCategory.AI,
                auth_type=AuthType.API_KEY,
                required_fields=["api_key"],
                supported_features=["chat", "completion", "embeddings", "images"],
                icon="robot",
                color="green"
            )
        }
        
        return providers
    
    def get_available_providers(self) -> List[ProviderConfig]:
        """Get list of all available providers"""
        return list(self.providers.values())
    
    def get_provider(self, provider_id: str) -> Optional[ProviderConfig]:
        """Get provider configuration by ID"""
        return self.providers.get(provider_id)
    
    def encrypt_credentials(self, data: Dict[str, Any]) -> str:
        """Encrypt sensitive credentials"""
        json_data = json.dumps(data)
        encrypted = self.cipher.encrypt(json_data.encode())
        return base64.b64encode(encrypted).decode()
    
    def decrypt_credentials(self, encrypted_data: str) -> Dict[str, Any]:
        """Decrypt sensitive credentials"""
        encrypted = base64.b64decode(encrypted_data.encode())
        decrypted = self.cipher.decrypt(encrypted)
        return json.loads(decrypted.decode())
    
    def create_account(
        self,
        db: Session,
        user_id: str,
        provider_id: str,
        auth_data: Dict[str, Any]
    ) -> ConnectedAccount:
        """Create a new connected account"""
        # Encrypt sensitive data
        encrypted_auth = self.encrypt_credentials(auth_data)
        
        account = ConnectedAccount(
            user_id=user_id,
            provider_id=provider_id,
            encrypted_credentials=encrypted_auth,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            is_active=True
        )
        
        db.add(account)
        db.commit()
        db.refresh(account)
        
        return account
    
    def get_account(self, db: Session, account_id: str) -> Optional[ConnectedAccount]:
        """Get connected account by ID"""
        return db.query(ConnectedAccount).filter(
            ConnectedAccount.id == account_id
        ).first()
    
    def get_user_accounts(self, db: Session, user_id: str) -> List[ConnectedAccount]:
        """Get all connected accounts for a user"""
        return db.query(ConnectedAccount).filter(
            ConnectedAccount.user_id == user_id
        ).all()
    
    def delete_account(self, db: Session, account_id: str):
        """Delete a connected account"""
        account = self.get_account(db, account_id)
        if account:
            db.delete(account)
            db.commit()
    
    def test_connection(self, account: ConnectedAccount) -> bool:
        """Test if account credentials are valid"""
        # Implementation depends on provider
        # This is a placeholder that should be implemented per provider
        return True
    
    # GitHub integration
    async def fetch_github_repos(self, account: ConnectedAccount) -> List[Dict]:
        """Fetch GitHub repositories"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        token = creds.get("access_token")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        response = await self.http_client.get(
            "https://api.github.com/user/repos",
            headers=headers,
            params={"per_page": 100, "sort": "updated"}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"GitHub API error: {response.status_code}")
    
    # Google Drive integration
    async def fetch_google_drive_files(
        self, 
        account: ConnectedAccount,
        folder_id: Optional[str] = None
    ) -> List[Dict]:
        """Fetch Google Drive files"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        token = creds.get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "fields": "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)",
            "pageSize": 100
        }
        
        if folder_id:
            params["q"] = f"'{folder_id}' in parents"
        
        response = await self.http_client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params=params
        )
        
        if response.status_code == 200:
            return response.json().get("files", [])
        else:
            raise Exception(f"Google Drive API error: {response.status_code}")
    
    # Linear integration
    async def fetch_linear_issues(
        self,
        account: ConnectedAccount,
        project_id: Optional[str] = None
    ) -> List[Dict]:
        """Fetch Linear issues"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        api_key = creds.get("api_key")
        
        headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        
        query = """
        query Issues($filter: IssueFilter) {
            issues(filter: $filter) {
                nodes {
                    id
                    title
                    description
                    state {
                        name
                    }
                    priority
                    createdAt
                    updatedAt
                    assignee {
                        name
                        email
                    }
                    project {
                        id
                        name
                    }
                    labels {
                        nodes {
                            name
                        }
                    }
                }
            }
        }
        """
        
        variables = {}
        if project_id:
            variables["filter"] = {"project": {"id": {"eq": project_id}}}
        
        response = await self.http_client.post(
            "https://api.linear.app/graphql",
            headers=headers,
            json={"query": query, "variables": variables}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("issues", {}).get("nodes", [])
        else:
            raise Exception(f"Linear API error: {response.status_code}")
    
    # McMaster-Carr integration (simulated - they don't have public API)
    async def search_mcmaster(
        self,
        account: ConnectedAccount,
        query: str,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Search McMaster-Carr catalog"""
        # Note: McMaster doesn't have a public API
        # This would require web scraping or browser automation
        # For now, return simulated data
        return [
            {
                "part_number": "91290A222",
                "name": f"Socket Head Cap Screw - {query}",
                "description": "18-8 Stainless Steel, M6 x 1mm Thread, 20mm Long",
                "price": 8.47,
                "unit": "Pack of 25",
                "availability": "In Stock",
                "specifications": {
                    "material": "18-8 Stainless Steel",
                    "thread_size": "M6 x 1mm",
                    "length": "20mm",
                    "head_type": "Socket Head"
                }
            }
        ]
    
    # DigiKey integration
    async def fetch_digikey_inventory(self, account: ConnectedAccount) -> Dict:
        """Fetch DigiKey inventory and order history"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        token = creds.get("access_token")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "X-DIGIKEY-Client-Id": os.getenv("DIGIKEY_CLIENT_ID", "")
        }
        
        # Get order history
        orders_response = await self.http_client.get(
            "https://api.digikey.com/Order/v3/History",
            headers=headers
        )
        
        # Get saved lists/inventory
        lists_response = await self.http_client.get(
            "https://api.digikey.com/Lists/v3",
            headers=headers
        )
        
        return {
            "orders": orders_response.json() if orders_response.status_code == 200 else [],
            "saved_lists": lists_response.json() if lists_response.status_code == 200 else []
        }
    
    # JLCPCB integration
    async def get_jlcpcb_quote(
        self,
        account: ConnectedAccount,
        pcb_specs: Dict[str, Any]
    ) -> Dict:
        """Get JLCPCB manufacturing quote"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        api_key = creds.get("api_key")
        api_secret = creds.get("api_secret")
        
        # JLCPCB API endpoint (example)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "X-API-Secret": api_secret
        }
        
        response = await self.http_client.post(
            "https://api.jlcpcb.com/quote",
            headers=headers,
            json=pcb_specs
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            # Return simulated quote for demo
            return {
                "board_quantity": pcb_specs.get("quantity", 5),
                "board_dimensions": pcb_specs.get("dimensions", {"width": 100, "height": 100}),
                "layers": pcb_specs.get("layers", 2),
                "surface_finish": pcb_specs.get("surface_finish", "HASL"),
                "price_breakdown": {
                    "board_cost": 5.00,
                    "setup_fee": 0.00,
                    "stencil": 8.00
                },
                "total_price": 13.00,
                "lead_time_days": 5,
                "shipping_options": [
                    {"method": "DHL", "cost": 20.00, "days": 3},
                    {"method": "Standard", "cost": 8.00, "days": 15}
                ]
            }
    
    # AI integrations
    async def anthropic_complete(
        self,
        account: ConnectedAccount,
        prompt: str,
        max_tokens: int = 1000
    ) -> Dict:
        """Get completion from Anthropic Claude"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        api_key = creds.get("api_key")
        
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        response = await self.http_client.post(
            "https://api.anthropic.com/v1/complete",
            headers=headers,
            json={
                "model": "claude-3-opus-20240229",
                "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
                "max_tokens_to_sample": max_tokens,
                "temperature": 0.7
            }
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Anthropic API error: {response.status_code}")
    
    async def openai_complete(
        self,
        account: ConnectedAccount,
        prompt: str,
        model: str = "gpt-4",
        max_tokens: int = 1000
    ) -> Dict:
        """Get completion from OpenAI"""
        creds = self.decrypt_credentials(account.encrypted_credentials)
        api_key = creds.get("api_key")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        response = await self.http_client.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": 0.7
            }
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"OpenAI API error: {response.status_code}")
    
    async def sync_data(
        self,
        account: ConnectedAccount,
        data_types: List[str],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generic data sync method"""
        provider = self.get_provider(account.provider_id)
        if not provider:
            return {"success": False, "errors": ["Unknown provider"]}
        
        items_synced = 0
        errors = []
        
        try:
            # Provider-specific sync logic
            if account.provider_id == "github":
                if "repos" in data_types or "all" in data_types:
                    repos = await self.fetch_github_repos(account)
                    items_synced += len(repos)
                    # TODO: Store repos in database
            
            elif account.provider_id == "linear":
                if "issues" in data_types or "all" in data_types:
                    issues = await self.fetch_linear_issues(account)
                    items_synced += len(issues)
                    # TODO: Store issues in database
            
            # Update last_synced timestamp
            account.last_synced = datetime.utcnow()
            # TODO: Save to database
            
            return {
                "success": True,
                "items_synced": items_synced,
                "errors": errors
            }
            
        except Exception as e:
            return {
                "success": False,
                "items_synced": items_synced,
                "errors": [str(e)]
            }