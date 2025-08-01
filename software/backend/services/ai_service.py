"""
Unified AI Service for Multiple Providers
Supports Anthropic Claude, OpenAI, Google Gemini, and Ollama
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

# AI Provider imports with fallback
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    anthropic = None

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

import aiohttp
import requests

logger = logging.getLogger(__name__)

class UnifiedAIService:
    """Unified service for handling multiple AI providers"""
    
    def __init__(self):
        self.providers_status = {
            "anthropic": ANTHROPIC_AVAILABLE,
            "openai": OPENAI_AVAILABLE,
            "google": GEMINI_AVAILABLE,
            "ollama": True  # Always available as it's HTTP-based
        }
        
    async def get_user_ai_config(self, user_id: str) -> Dict[str, Any]:
        """Load user's AI configuration"""
        config_path = os.path.join("storage", "users", str(user_id), ".ai_config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading AI config for user {user_id}: {e}")
        return {}
    
    async def chat_completion(
        self,
        user_id: str,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Send a chat completion request to the user's configured AI provider
        
        Args:
            user_id: The user's ID
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of tools for function calling
            max_tokens: Maximum tokens in response
            temperature: Creativity parameter (0-1)
            
        Returns:
            Dict with 'response', 'provider', 'model', and optional 'tool_calls'
        """
        # Get user's AI configuration
        config = await self.get_user_ai_config(user_id)
        
        if not config.get("active_provider"):
            # Try environment variable providers first
            if os.getenv("ANTHROPIC_API_KEY") and ANTHROPIC_AVAILABLE:
                return await self._anthropic_completion_env(messages, tools, max_tokens, temperature)
            elif os.getenv("OPENAI_API_KEY") and OPENAI_AVAILABLE:
                return await self._openai_completion_env(messages, tools, max_tokens, temperature)
            else:
                return {
                    "response": "No AI provider configured. Please configure an AI provider in your account settings.",
                    "provider": "none",
                    "model": "none",
                    "error": True
                }
        
        # Use configured provider
        provider_id = config["active_provider"]
        provider_config = config.get("providers", {}).get(provider_id, {})
        
        if not provider_config.get("api_key"):
            return {
                "response": f"API key not configured for {provider_id}. Please check your settings.",
                "provider": provider_id,
                "model": "none",
                "error": True
            }
        
        # Route to appropriate provider
        if provider_id == "anthropic":
            return await self._anthropic_completion(provider_config, messages, tools, max_tokens, temperature)
        elif provider_id == "openai":
            return await self._openai_completion(provider_config, messages, tools, max_tokens, temperature)
        elif provider_id == "google":
            return await self._gemini_completion(provider_config, messages, tools, max_tokens, temperature)
        elif provider_id == "ollama":
            return await self._ollama_completion(provider_config, messages, tools, max_tokens, temperature)
        else:
            return {
                "response": f"Unknown provider: {provider_id}",
                "provider": provider_id,
                "model": "none",
                "error": True
            }
    
    async def _anthropic_completion_env(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """Anthropic completion using environment variable"""
        if not ANTHROPIC_AVAILABLE:
            return {
                "response": "Anthropic library not installed",
                "provider": "anthropic",
                "model": "none",
                "error": True
            }
            
        try:
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            
            # Extract system message if present
            system_message = None
            anthropic_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    anthropic_messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            kwargs = {
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": anthropic_messages
            }
            
            if system_message:
                kwargs["system"] = system_message
            
            if tools:
                kwargs["tools"] = tools
            
            response = client.messages.create(**kwargs)
            
            # Handle tool calls if present
            if hasattr(response, 'content') and len(response.content) > 0:
                first_content = response.content[0]
                if hasattr(first_content, 'type') and first_content.type == 'tool_use':
                    return {
                        "response": "",
                        "provider": "anthropic",
                        "model": "claude-3-5-sonnet-20241022",
                        "tool_calls": [{
                            "id": first_content.id,
                            "name": first_content.name,
                            "arguments": first_content.input
                        }]
                    }
            
            return {
                "response": response.content[0].text if response.content else "",
                "provider": "anthropic",
                "model": "claude-3-5-sonnet-20241022"
            }
            
        except Exception as e:
            logger.error(f"Anthropic completion error: {e}")
            return {
                "response": f"Error with Anthropic: {str(e)}",
                "provider": "anthropic",
                "model": "claude-3-5-sonnet-20241022",
                "error": True
            }
    
    async def _anthropic_completion(
        self,
        config: Dict[str, Any],
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """Anthropic completion using user configuration"""
        if not ANTHROPIC_AVAILABLE:
            return {
                "response": "Anthropic library not installed",
                "provider": "anthropic",
                "model": config.get("model", "unknown"),
                "error": True
            }
            
        try:
            client = anthropic.Anthropic(api_key=config["api_key"])
            
            # Extract system message if present
            system_message = None
            anthropic_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    anthropic_messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            kwargs = {
                "model": config.get("model", "claude-3-5-sonnet-20241022"),
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": anthropic_messages
            }
            
            if system_message:
                kwargs["system"] = system_message
            
            if tools:
                kwargs["tools"] = tools
            
            response = client.messages.create(**kwargs)
            
            # Handle tool calls if present
            if hasattr(response, 'content') and len(response.content) > 0:
                first_content = response.content[0]
                if hasattr(first_content, 'type') and first_content.type == 'tool_use':
                    return {
                        "response": "",
                        "provider": "anthropic",
                        "model": config.get("model", "claude-3-5-sonnet-20241022"),
                        "tool_calls": [{
                            "id": first_content.id,
                            "name": first_content.name,
                            "arguments": first_content.input
                        }]
                    }
            
            return {
                "response": response.content[0].text if response.content else "",
                "provider": "anthropic",
                "model": config.get("model", "claude-3-5-sonnet-20241022")
            }
            
        except Exception as e:
            logger.error(f"Anthropic completion error: {e}")
            return {
                "response": f"Error with Anthropic: {str(e)}",
                "provider": "anthropic",
                "model": config.get("model", "unknown"),
                "error": True
            }
    
    async def _openai_completion_env(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """OpenAI completion using environment variable"""
        if not OPENAI_AVAILABLE:
            return {
                "response": "OpenAI library not installed",
                "provider": "openai",
                "model": "none",
                "error": True
            }
            
        try:
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            kwargs = {
                "model": "gpt-3.5-turbo",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            if tools:
                kwargs["tools"] = tools
            
            response = client.chat.completions.create(**kwargs)
            
            # Handle tool calls
            if response.choices[0].message.tool_calls:
                tool_calls = []
                for tc in response.choices[0].message.tool_calls:
                    tool_calls.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments)
                    })
                return {
                    "response": "",
                    "provider": "openai",
                    "model": "gpt-3.5-turbo",
                    "tool_calls": tool_calls
                }
            
            return {
                "response": response.choices[0].message.content,
                "provider": "openai",
                "model": "gpt-3.5-turbo"
            }
            
        except Exception as e:
            logger.error(f"OpenAI completion error: {e}")
            return {
                "response": f"Error with OpenAI: {str(e)}",
                "provider": "openai",
                "model": "gpt-3.5-turbo",
                "error": True
            }
    
    async def _openai_completion(
        self,
        config: Dict[str, Any],
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """OpenAI completion using user configuration"""
        if not OPENAI_AVAILABLE:
            return {
                "response": "OpenAI library not installed",
                "provider": "openai",
                "model": config.get("model", "unknown"),
                "error": True
            }
            
        try:
            client = OpenAI(api_key=config["api_key"])
            
            kwargs = {
                "model": config.get("model", "gpt-3.5-turbo"),
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            if tools:
                kwargs["tools"] = tools
            
            response = client.chat.completions.create(**kwargs)
            
            # Handle tool calls
            if response.choices[0].message.tool_calls:
                tool_calls = []
                for tc in response.choices[0].message.tool_calls:
                    tool_calls.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments)
                    })
                return {
                    "response": "",
                    "provider": "openai",
                    "model": config.get("model", "gpt-3.5-turbo"),
                    "tool_calls": tool_calls
                }
            
            return {
                "response": response.choices[0].message.content,
                "provider": "openai",
                "model": config.get("model", "gpt-3.5-turbo")
            }
            
        except Exception as e:
            logger.error(f"OpenAI completion error: {e}")
            return {
                "response": f"Error with OpenAI: {str(e)}",
                "provider": "openai",
                "model": config.get("model", "unknown"),
                "error": True
            }
    
    async def _gemini_completion(
        self,
        config: Dict[str, Any],
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """Google Gemini completion"""
        if not GEMINI_AVAILABLE:
            return {
                "response": "Google Generative AI library not installed",
                "provider": "google",
                "model": config.get("model", "unknown"),
                "error": True
            }
            
        try:
            genai.configure(api_key=config["api_key"])
            model = genai.GenerativeModel(config.get("model", "gemini-pro"))
            
            # Convert messages to Gemini format
            chat = model.start_chat(history=[])
            
            # Send the last message (Gemini handles history differently)
            if messages:
                last_message = messages[-1]["content"]
                response = chat.send_message(last_message)
                
                return {
                    "response": response.text,
                    "provider": "google",
                    "model": config.get("model", "gemini-pro")
                }
            else:
                return {
                    "response": "No messages provided",
                    "provider": "google",
                    "model": config.get("model", "gemini-pro"),
                    "error": True
                }
                
        except Exception as e:
            logger.error(f"Gemini completion error: {e}")
            return {
                "response": f"Error with Gemini: {str(e)}",
                "provider": "google",
                "model": config.get("model", "unknown"),
                "error": True
            }
    
    async def _ollama_completion(
        self,
        config: Dict[str, Any],
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """Ollama local completion"""
        try:
            endpoint = config.get("endpoint", "http://localhost:11434")
            model = config.get("model", "llama2")
            
            # Convert messages to prompt
            prompt = ""
            for msg in messages:
                if msg["role"] == "system":
                    prompt += f"System: {msg['content']}\n\n"
                elif msg["role"] == "user":
                    prompt += f"User: {msg['content']}\n\n"
                elif msg["role"] == "assistant":
                    prompt += f"Assistant: {msg['content']}\n\n"
            
            prompt += "Assistant: "
            
            # Make request to Ollama
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{endpoint}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens
                        }
                    }
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "response": data["response"],
                            "provider": "ollama",
                            "model": model
                        }
                    else:
                        error_text = await response.text()
                        return {
                            "response": f"Ollama error: {response.status} - {error_text}",
                            "provider": "ollama",
                            "model": model,
                            "error": True
                        }
                        
        except Exception as e:
            logger.error(f"Ollama completion error: {e}")
            return {
                "response": f"Error connecting to Ollama: {str(e)}",
                "provider": "ollama",
                "model": config.get("model", "unknown"),
                "error": True
            }
    
    async def simple_query(self, user_id: str, query: str) -> Dict[str, Any]:
        """Simple query interface for basic questions"""
        messages = [
            {
                "role": "system",
                "content": "You are WIT (Workshop Intelligence Terminal), a helpful AI assistant for workshop management, 3D printing, electronics, and general technical questions."
            },
            {
                "role": "user",
                "content": query
            }
        ]
        
        return await self.chat_completion(
            user_id=user_id,
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )

# Singleton instance
ai_service = UnifiedAIService()