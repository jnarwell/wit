#!/usr/bin/env python3
"""
W.I.T. Voice API with Memory System

Enhanced API that remembers users, projects, and all conversations.
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Cookie, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import jwt
from datetime import datetime, timedelta
import logging

# Import memory-enabled processor
from software.ai.voice.memory.memory_voice_processor import (
    MemoryEnabledVoiceProcessor, MemoryWorkshopAssistant,
    ProcessingConfig
)
from software.ai.voice.memory.memory_system import Project, User

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/memory", tags=["memory-voice"])

# Security
security = HTTPBearer(auto_error=False)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this")

# Global processor instance
memory_processor: Optional[MemoryEnabledVoiceProcessor] = None
memory_assistant: Optional[MemoryWorkshopAssistant] = None


# Request/Response Models
class UserRegistration(BaseModel):
    """User registration model"""
    name: str = Field(..., description="User's name")
    voice_sample: Optional[str] = Field(None, description="Base64 encoded voice sample")
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)


class UserSession(BaseModel):
    """User session info"""
    user_id: str
    user_name: str
    session_id: str
    token: str
    expires_at: datetime


class MemoryCommand(BaseModel):
    """Command with user context"""
    command: str = Field(..., description="Voice command text")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MemoryResponse(BaseModel):
    """Response with memory context"""
    response: str
    intent: str
    entities: Dict[str, Any]
    user_context_used: bool
    user_name: str
    active_project: Optional[str] = None
    conversation_id: str
    suggestions: Optional[List[str]] = None


class ProjectCreate(BaseModel):
    """Create new project"""
    name: str
    description: str
    equipment_needed: Optional[List[str]] = Field(default_factory=list)


class ConversationSearch(BaseModel):
    """Search conversations"""
    query: str
    limit: int = Field(default=5, ge=1, le=20)


# Authentication helpers
def create_token(user_id: str, user_name: str) -> str:
    """Create JWT token"""
    payload = {
        'user_id': user_id,
        'user_name': user_name,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session_token: Optional[str] = Cookie(None)
) -> Dict[str, str]:
    """Get current user from token"""
    token = None
    
    if credentials:
        token = credentials.credentials
    elif session_token:
        token = session_token
        
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    return {
        'user_id': payload['user_id'],
        'user_name': payload['user_name']
    }


# Initialize on startup
@router.on_event("startup")
async def startup_event():
    """Initialize memory processor on startup"""
    global memory_processor, memory_assistant
    
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        
        config = ProcessingConfig(
            anthropic_api_key=api_key,
            claude_model="claude-3-5-sonnet-20241022"
        )
        
        memory_processor = MemoryEnabledVoiceProcessor(config)
        memory_assistant = MemoryWorkshopAssistant(memory_processor)
        
        await memory_processor.start()
        logger.info("Memory-enabled voice processor initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize memory processor: {e}")


# User Management Endpoints
@router.post("/register", response_model=UserSession)
async def register_user(registration: UserRegistration, response: Response):
    """Register new user or login existing"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    # Create or get user
    user_id = await memory_processor.memory_manager.identify_user(
        name=registration.name,
        voice_sample=registration.voice_sample.encode() if registration.voice_sample else None
    )
    
    # Start session
    session_id = await memory_processor.memory_manager.start_session(user_id)
    
    # Create token
    token = create_token(user_id, registration.name)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        max_age=86400,  # 24 hours
        httponly=True,
        samesite="lax"
    )
    
    return UserSession(
        user_id=user_id,
        user_name=registration.name,
        session_id=session_id,
        token=token,
        expires_at=datetime.now() + timedelta(hours=24)
    )


@router.get("/profile")
async def get_user_profile(current_user: Dict = Depends(get_current_user)):
    """Get user profile with stats"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    user = await memory_processor.memory_manager.db.get_user(current_user['user_id'])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get stats
    context = await memory_processor.memory_manager.db.build_user_context(current_user['user_id'])
    
    return {
        "user": {
            "id": user.user_id,
            "name": user.name,
            "created_at": user.created_at.isoformat(),
            "skill_level": user.skill_level,
            "preferences": user.preferences
        },
        "stats": {
            "total_conversations": context.get('conversation_count', 0),
            "total_projects": context.get('projects_count', 0),
            "equipment_access": user.equipment_access,
            "recent_activity": context.get('recent_conversations', [])[:3]
        }
    }


# Memory-Enhanced Commands
@router.post("/command", response_model=MemoryResponse)
async def process_memory_command(
    request: MemoryCommand,
    current_user: Dict = Depends(get_current_user)
):
    """Process command with user memory"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    # Set current user
    memory_processor.current_user_id = current_user['user_id']
    if not memory_processor.current_session_id:
        memory_processor.current_session_id = await memory_processor.memory_manager.start_session(
            current_user['user_id']
        )
    
    # Process with memory
    result = await memory_processor.understand_with_memory(
        request.command,
        request.context
    )
    
    # Get active project
    active_project = await memory_processor.memory_manager.db.get_active_project(
        current_user['user_id']
    )
    
    # Generate suggestions based on context
    suggestions = await _generate_suggestions(current_user['user_id'], result.intent)
    
    return MemoryResponse(
        response=result.claude_response or "Command processed",
        intent=result.intent,
        entities=result.entities,
        user_context_used=True,
        user_name=current_user['user_name'],
        active_project=active_project.name if active_project else None,
        conversation_id=memory_processor.current_session_id,
        suggestions=suggestions
    )


# Project Management
@router.post("/projects", response_model=Dict[str, Any])
async def create_project(
    project: ProjectCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create new project"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    created_project = await memory_processor.memory_manager.db.create_project(
        current_user['user_id'],
        project.name,
        project.description
    )
    
    return {
        "project_id": created_project.project_id,
        "name": created_project.name,
        "description": created_project.description,
        "created_at": created_project.created_at.isoformat(),
        "status": created_project.status
    }


@router.get("/projects")
async def list_projects(
    current_user: Dict = Depends(get_current_user),
    status: Optional[str] = None
):
    """List user's projects"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    # Get all projects (would need to add this method to MemoryDatabase)
    query = "SELECT * FROM projects WHERE user_id = ?"
    params = [current_user['user_id']]
    
    if status:
        query += " AND status = ?"
        params.append(status)
        
    query += " ORDER BY updated_at DESC"
    
    rows = memory_processor.memory_manager.db.conn.execute(query, params).fetchall()
    
    projects = []
    for row in rows:
        projects.append({
            "project_id": row['project_id'],
            "name": row['name'],
            "description": row['description'],
            "status": row['status'],
            "updated_at": row['updated_at'],
            "time_spent": row['time_spent']
        })
        
    return {"projects": projects}


# Conversation History
@router.get("/conversations")
async def get_conversations(
    current_user: Dict = Depends(get_current_user),
    limit: int = 10,
    project_id: Optional[str] = None
):
    """Get conversation history"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    conversations = await memory_processor.memory_manager.db.get_conversation_history(
        current_user['user_id'],
        limit=limit,
        project_id=project_id
    )
    
    return {
        "conversations": [
            {
                "id": conv.conversation_id,
                "timestamp": conv.timestamp.isoformat(),
                "command": conv.command,
                "intent": conv.intent,
                "response": conv.response[:200] + "..." if len(conv.response) > 200 else conv.response,
                "project_id": conv.project_id
            }
            for conv in conversations
        ]
    }


@router.post("/conversations/search")
async def search_conversations(
    search: ConversationSearch,
    current_user: Dict = Depends(get_current_user)
):
    """Search through conversation history"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    results = await memory_processor.memory_manager.db.search_conversations(
        current_user['user_id'],
        search.query,
        search.limit
    )
    
    return {
        "query": search.query,
        "results": [
            {
                "id": conv.conversation_id,
                "timestamp": conv.timestamp.isoformat(),
                "command": conv.command,
                "response": conv.response[:200] + "..." if len(conv.response) > 200 else conv.response,
                "relevance": "high"  # Would be calculated by similarity score
            }
            for conv in results
        ]
    }


# Equipment History
@router.get("/equipment/{equipment_id}/history")
async def get_equipment_history(
    equipment_id: str,
    current_user: Dict = Depends(get_current_user),
    days: int = 30
):
    """Get equipment usage history"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    logs = await memory_processor.memory_manager.db.get_equipment_history(
        current_user['user_id'],
        equipment_id,
        days
    )
    
    return {
        "equipment_id": equipment_id,
        "history": [
            {
                "timestamp": log.timestamp.isoformat(),
                "action": log.action,
                "parameters": log.parameters,
                "duration": log.duration,
                "project_id": log.project_id
            }
            for log in logs
        ]
    }


# Learning & Insights
@router.get("/insights")
async def get_user_insights(current_user: Dict = Depends(get_current_user)):
    """Get learned insights about user"""
    if not memory_processor:
        raise HTTPException(status_code=503, detail="Memory processor not initialized")
        
    insights = await memory_processor.memory_manager.db.get_user_insights(
        current_user['user_id']
    )
    
    return {
        "insights": insights,
        "personalization_level": min(len(insights) * 10, 100)  # 0-100%
    }


# Helper functions
async def _generate_suggestions(user_id: str, last_intent: str) -> List[str]:
    """Generate contextual suggestions"""
    suggestions = []
    
    if last_intent == "control_equipment":
        suggestions.extend([
            "Check equipment status",
            "View safety guidelines",
            "Start a new project"
        ])
    elif last_intent == "get_status":
        suggestions.extend([
            "Start the equipment",
            "View maintenance schedule",
            "Check material levels"
        ])
    elif last_intent == "project_help":
        suggestions.extend([
            "Show similar projects",
            "Find tutorials",
            "Order materials"
        ])
        
    return suggestions[:3]


# Test endpoint
@router.get("/test")
async def test_memory_system():
    """Test memory system"""
    return {
        "status": "ready" if memory_processor else "not_initialized",
        "memory_enabled": True,
        "features": [
            "User identification",
            "Conversation memory",
            "Project tracking",
            "Equipment history",
            "Learning insights",
            "Contextual responses"
        ]
    }