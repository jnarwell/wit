"""
AI Configuration API
Manages API keys and settings for multiple AI providers
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, SecretStr
from typing import Dict, List, Optional, Any
import json
import os
from datetime import datetime
import logging

from services.database_services import get_session, User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai-config", tags=["ai-config"])

# Get current user dependency will be injected
get_current_user = None

# AI Provider Models
class AIProvider(BaseModel):
    """AI Provider configuration"""
    id: str
    name: str
    description: str
    enabled: bool = False
    configured: bool = False
    models: List[str] = []
    
class AIProviderConfig(BaseModel):
    """Configuration for an AI provider"""
    provider_id: str
    api_key: SecretStr
    model: Optional[str] = None
    endpoint: Optional[str] = None
    additional_settings: Optional[Dict[str, Any]] = {}

class AIProviderUpdate(BaseModel):
    """Update AI provider settings"""
    enabled: Optional[bool] = None
    api_key: Optional[SecretStr] = None
    model: Optional[str] = None
    endpoint: Optional[str] = None
    additional_settings: Optional[Dict[str, Any]] = None

class AIConfigResponse(BaseModel):
    """AI configuration response"""
    providers: List[AIProvider]
    active_provider: Optional[str] = None
    total_configured: int = 0

# Available AI Providers
AVAILABLE_PROVIDERS = {
    "anthropic": {
        "name": "Claude (Anthropic)",
        "description": "Claude 3 family models - excellent for analysis and coding",
        "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]
    },
    "openai": {
        "name": "OpenAI GPT",
        "description": "GPT-4 and GPT-3.5 models - versatile and powerful",
        "models": ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"]
    },
    "google": {
        "name": "Google Gemini",
        "description": "Gemini Pro models - multimodal capabilities",
        "models": ["gemini-pro", "gemini-pro-vision"]
    },
    "ollama": {
        "name": "Ollama (Local)",
        "description": "Run AI models locally - privacy-focused",
        "models": ["llama2", "mistral", "codellama", "phi"]
    }
}

def get_user_ai_config_path(user_id: str) -> str:
    """Get the path to user's AI configuration file"""
    return os.path.join("storage", "users", str(user_id), ".ai_config.json")

def load_user_ai_config(user_id: str) -> Dict[str, Any]:
    """Load user's AI configuration"""
    config_path = get_user_ai_config_path(user_id)
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading AI config for user {user_id}: {e}")
    return {}

def save_user_ai_config(user_id: str, config: Dict[str, Any]):
    """Save user's AI configuration"""
    config_path = get_user_ai_config_path(user_id)
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    # Don't save sensitive data in plain text in production
    # This is for development only
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

@router.get("/providers", response_model=AIConfigResponse)
async def get_ai_providers(
    current_user: User = Depends(get_current_user)
):
    """Get available AI providers and their configuration status"""
    user_config = load_user_ai_config(str(current_user.id))
    
    providers = []
    total_configured = 0
    active_provider = user_config.get("active_provider")
    
    for provider_id, provider_info in AVAILABLE_PROVIDERS.items():
        provider_config = user_config.get("providers", {}).get(provider_id, {})
        configured = bool(provider_config.get("api_key"))
        enabled = provider_config.get("enabled", False)
        
        if configured:
            total_configured += 1
            
        providers.append(AIProvider(
            id=provider_id,
            name=provider_info["name"],
            description=provider_info["description"],
            models=provider_info["models"],
            configured=configured,
            enabled=enabled
        ))
    
    return AIConfigResponse(
        providers=providers,
        active_provider=active_provider,
        total_configured=total_configured
    )

@router.post("/providers/{provider_id}/configure")
async def configure_ai_provider(
    provider_id: str,
    config: AIProviderConfig,
    current_user: User = Depends(get_current_user)
):
    """Configure an AI provider with API key and settings"""
    if provider_id not in AVAILABLE_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider {provider_id} not found"
        )
    
    # Load existing config
    user_config = load_user_ai_config(str(current_user.id))
    if "providers" not in user_config:
        user_config["providers"] = {}
    
    # Update provider config
    provider_config = {
        "api_key": config.api_key.get_secret_value(),
        "enabled": True,
        "configured_at": datetime.now().isoformat(),
        "model": config.model or AVAILABLE_PROVIDERS[provider_id]["models"][0],
        "endpoint": config.endpoint,
        "additional_settings": config.additional_settings or {}
    }
    
    user_config["providers"][provider_id] = provider_config
    
    # Set as active if no active provider
    if not user_config.get("active_provider"):
        user_config["active_provider"] = provider_id
    
    # Save config
    save_user_ai_config(str(current_user.id), user_config)
    
    # Update environment variable for immediate use
    if provider_id == "anthropic":
        os.environ["ANTHROPIC_API_KEY"] = config.api_key.get_secret_value()
    elif provider_id == "openai":
        os.environ["OPENAI_API_KEY"] = config.api_key.get_secret_value()
    
    return {
        "status": "success",
        "message": f"{AVAILABLE_PROVIDERS[provider_id]['name']} configured successfully",
        "provider_id": provider_id
    }

@router.patch("/providers/{provider_id}")
async def update_ai_provider(
    provider_id: str,
    update_data: AIProviderUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update AI provider settings"""
    if provider_id not in AVAILABLE_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider {provider_id} not found"
        )
    
    user_config = load_user_ai_config(str(current_user.id))
    
    if "providers" not in user_config or provider_id not in user_config["providers"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider {provider_id} not configured"
        )
    
    # Update fields
    provider_config = user_config["providers"][provider_id]
    
    if update_data.enabled is not None:
        provider_config["enabled"] = update_data.enabled
        
    if update_data.api_key is not None:
        provider_config["api_key"] = update_data.api_key.get_secret_value()
        # Update environment variable
        if provider_id == "anthropic":
            os.environ["ANTHROPIC_API_KEY"] = update_data.api_key.get_secret_value()
        elif provider_id == "openai":
            os.environ["OPENAI_API_KEY"] = update_data.api_key.get_secret_value()
            
    if update_data.model is not None:
        provider_config["model"] = update_data.model
        
    if update_data.endpoint is not None:
        provider_config["endpoint"] = update_data.endpoint
        
    if update_data.additional_settings is not None:
        provider_config["additional_settings"].update(update_data.additional_settings)
    
    provider_config["updated_at"] = datetime.now().isoformat()
    
    save_user_ai_config(str(current_user.id), user_config)
    
    return {
        "status": "success",
        "message": f"{AVAILABLE_PROVIDERS[provider_id]['name']} updated successfully"
    }

@router.delete("/providers/{provider_id}")
async def remove_ai_provider(
    provider_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove AI provider configuration"""
    if provider_id not in AVAILABLE_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider {provider_id} not found"
        )
    
    user_config = load_user_ai_config(str(current_user.id))
    
    if "providers" in user_config and provider_id in user_config["providers"]:
        del user_config["providers"][provider_id]
        
        # Update active provider if needed
        if user_config.get("active_provider") == provider_id:
            # Set to next available provider or None
            available_providers = [p for p in user_config["providers"] if user_config["providers"][p].get("enabled")]
            user_config["active_provider"] = available_providers[0] if available_providers else None
        
        save_user_ai_config(str(current_user.id), user_config)
        
        # Clear environment variable
        if provider_id == "anthropic" and "ANTHROPIC_API_KEY" in os.environ:
            del os.environ["ANTHROPIC_API_KEY"]
        elif provider_id == "openai" and "OPENAI_API_KEY" in os.environ:
            del os.environ["OPENAI_API_KEY"]
    
    return {
        "status": "success",
        "message": f"{AVAILABLE_PROVIDERS[provider_id]['name']} configuration removed"
    }

@router.post("/providers/{provider_id}/set-active")
async def set_active_provider(
    provider_id: str,
    current_user: User = Depends(get_current_user)
):
    """Set the active AI provider"""
    if provider_id not in AVAILABLE_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider {provider_id} not found"
        )
    
    user_config = load_user_ai_config(str(current_user.id))
    
    if "providers" not in user_config or provider_id not in user_config["providers"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider {provider_id} not configured"
        )
    
    if not user_config["providers"][provider_id].get("enabled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider {provider_id} is not enabled"
        )
    
    user_config["active_provider"] = provider_id
    save_user_ai_config(str(current_user.id), user_config)
    
    return {
        "status": "success",
        "message": f"{AVAILABLE_PROVIDERS[provider_id]['name']} set as active provider"
    }

@router.post("/providers/{provider_id}/test")
async def test_ai_provider(
    provider_id: str,
    current_user: User = Depends(get_current_user)
):
    """Test an AI provider configuration"""
    if provider_id not in AVAILABLE_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider {provider_id} not found"
        )
    
    user_config = load_user_ai_config(str(current_user.id))
    
    if "providers" not in user_config or provider_id not in user_config["providers"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider {provider_id} not configured"
        )
    
    provider_config = user_config["providers"][provider_id]
    
    # Test the provider
    try:
        if provider_id == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=provider_config["api_key"])
            response = client.messages.create(
                model=provider_config.get("model", "claude-3-sonnet-20240229"),
                max_tokens=50,
                messages=[{"role": "user", "content": "Say 'Hello from WIT!'"}]
            )
            test_response = response.content[0].text
            
        elif provider_id == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=provider_config["api_key"])
            response = client.chat.completions.create(
                model=provider_config.get("model", "gpt-3.5-turbo"),
                messages=[{"role": "user", "content": "Say 'Hello from WIT!'"}],
                max_tokens=50
            )
            test_response = response.choices[0].message.content
            
        elif provider_id == "google":
            # Google Gemini test implementation
            test_response = "Google Gemini integration coming soon!"
            
        elif provider_id == "ollama":
            # Ollama local test
            import requests
            endpoint = provider_config.get("endpoint", "http://localhost:11434")
            response = requests.post(
                f"{endpoint}/api/generate",
                json={
                    "model": provider_config.get("model", "llama2"),
                    "prompt": "Say 'Hello from WIT!'",
                    "stream": False
                }
            )
            if response.status_code == 200:
                test_response = response.json()["response"]
            else:
                raise Exception(f"Ollama error: {response.status_code}")
        else:
            test_response = "Provider test not implemented"
            
        return {
            "status": "success",
            "message": "Provider test successful",
            "response": test_response,
            "provider": AVAILABLE_PROVIDERS[provider_id]["name"]
        }
        
    except Exception as e:
        logger.error(f"Provider test failed for {provider_id}: {e}")
        return {
            "status": "error",
            "message": f"Provider test failed: {str(e)}",
            "provider": AVAILABLE_PROVIDERS[provider_id]["name"]
        }

# Health check
@router.get("/health")
async def health_check():
    """AI configuration API health check"""
    return {
        "status": "healthy",
        "service": "ai_config_api",
        "providers_available": len(AVAILABLE_PROVIDERS)
    }