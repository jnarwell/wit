"""
Base OAuth Service
Provides common OAuth functionality for all providers
"""
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import httpx
import logging
from cryptography.fernet import Fernet
import os
import base64
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from project root .env
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"Loaded .env from: {env_path}")

# Generate or load encryption key for tokens
ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Generate a new key for development
    ENCRYPTION_KEY = base64.urlsafe_b64encode(os.urandom(32)).decode()
    logger.warning("No TOKEN_ENCRYPTION_KEY found. Using generated key (not for production!)")

cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

class TokenEncryption:
    """Handle encryption/decryption of OAuth tokens"""
    
    @staticmethod
    def encrypt(token: str) -> str:
        """Encrypt a token"""
        return cipher_suite.encrypt(token.encode()).decode()
    
    @staticmethod
    def decrypt(encrypted_token: str) -> str:
        """Decrypt a token"""
        return cipher_suite.decrypt(encrypted_token.encode()).decode()

class OAuthProvider(ABC):
    """Base class for OAuth providers"""
    
    def __init__(self):
        self.client_id = ""
        self.client_secret = ""
        self.redirect_uri = ""
        self.auth_url = ""
        self.token_url = ""
        self.scopes: List[str] = []
        
    @abstractmethod
    def get_authorization_url(self, state: str) -> str:
        """Get the OAuth authorization URL"""
        pass
    
    @abstractmethod
    async def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange authorization code for access token"""
        pass
    
    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh an access token using refresh token"""
        pass
    
    @abstractmethod
    async def get_user_info(self, access_token: str) -> Dict:
        """Get user information using access token"""
        pass
    
    @abstractmethod
    async def revoke_token(self, token: str) -> bool:
        """Revoke an access or refresh token"""
        pass

class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth 2.0 provider"""
    
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        # Allow override via environment variable
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback")
        self.auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"
        self.scopes = [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/gmail.readonly"
        ]
    
    def get_authorization_url(self, state: str) -> str:
        """Get Google OAuth authorization URL"""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "access_type": "offline",
            "prompt": "consent"
        }
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.auth_url}?{query_string}"
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange authorization code for tokens"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh Google access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "refresh_token"
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict:
        """Get Google user information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def revoke_token(self, token: str) -> bool:
        """Revoke Google token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": token}
            )
            return response.status_code == 200

class GitHubOAuthProvider(OAuthProvider):
    """GitHub OAuth provider"""
    
    def __init__(self):
        super().__init__()
        self.client_id = os.getenv("GITHUB_CLIENT_ID", "")
        self.client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
        self.redirect_uri = "http://localhost:8000/api/v1/auth/github/callback"
        self.auth_url = "https://github.com/login/oauth/authorize"
        self.token_url = "https://github.com/login/oauth/access_token"
        self.scopes = ["repo", "user", "gist"]
    
    def get_authorization_url(self, state: str) -> str:
        """Get GitHub OAuth authorization URL"""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state
        }
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.auth_url}?{query_string}"
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange authorization code for tokens"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri
                },
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """GitHub doesn't support refresh tokens"""
        raise NotImplementedError("GitHub doesn't support refresh tokens")
    
    async def get_user_info(self, access_token: str) -> Dict:
        """Get GitHub user information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def revoke_token(self, token: str) -> bool:
        """Revoke GitHub token"""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"https://api.github.com/applications/{self.client_id}/token",
                auth=(self.client_id, self.client_secret),
                json={"access_token": token}
            )
            return response.status_code == 204

# Provider factory
def get_oauth_provider(provider_name: str) -> OAuthProvider:
    """Get OAuth provider instance by name"""
    providers = {
        "google": GoogleOAuthProvider,
        "github": GitHubOAuthProvider,
        # Add more providers here
    }
    
    provider_class = providers.get(provider_name.lower())
    if not provider_class:
        raise ValueError(f"Unknown OAuth provider: {provider_name}")
    
    return provider_class()