"""
W.I.T. Terminal API
Comprehensive terminal command processing with AI integration
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
import json
import logging
import asyncio
from datetime import datetime

from services.database_services import get_session, User
from services.ai_service import ai_service
from services.ai_tools import (
    list_files, read_file, write_file, create_file, delete_file,
    get_equipment_status, run_equipment_command, search_logs,
    tools, tool_functions
)
# Temporarily disable ai_project_tools imports to fix module issues
# from services.ai_project_tools import (
#     create_task, list_tasks, update_task, delete_task,
#     add_team_member, list_team_members, remove_team_member,
#     get_project_stats, get_project_details, search_projects
# )

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/terminal", tags=["terminal"])

# Import get_current_user from parent module  
# This will be resolved when router is included in main app
get_current_user = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# Request/Response Models
class CommandRequest(BaseModel):
    """Terminal command request"""
    command: str = Field(..., description="The command to execute")
    history: List[Dict[str, Any]] = Field(default_factory=list, description="Conversation history")
    agents: List[str] = Field(default_factory=lambda: ["wit-primary"], description="AI agents to use")
    synthesize: bool = Field(default=False, description="Synthesize multi-agent responses")

class CommandResponse(BaseModel):
    """Terminal command response"""
    response: str
    command_type: Optional[str] = None
    execution_time: float
    metadata: Optional[Dict[str, Any]] = None

class AIQueryRequest(BaseModel):
    """AI query request for general questions"""
    query: str
    context: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

class AIQueryResponse(BaseModel):
    """AI query response"""
    response: str
    provider: str
    model: str
    tokens_used: Optional[int] = None

class SystemStatusResponse(BaseModel):
    """System status response"""
    status: str
    services: Dict[str, bool]
    stats: Dict[str, Any]

# Command processing
@router.post("/command", response_model=CommandResponse)
async def process_command(
    request: CommandRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Process a terminal command with full AI integration
    """
    start_time = datetime.now()
    
    try:
        # Log the command
        logger.info(f"Processing command from user {current_user.username}: {request.command}")
        
        # Send real-time update via WebSocket if connected
        if str(current_user.id) in manager.active_connections:
            await manager.send_personal_message(
                json.dumps({
                    "type": "command_processing",
                    "command": request.command,
                    "timestamp": start_time.isoformat()
                }),
                str(current_user.id)
            )
        
        # Process with unified AI service
        # Build conversation with system prompt and history
        messages = [
            {
                "role": "system",
                "content": """You are W.I.T. (Workshop Intelligence Terminal), an AI assistant integrated into a workshop management system.
                
                You can help with:
                - File management (create, read, write, delete files)
                - Project management (create projects, manage tasks, team members)
                - Equipment control (3D printers, machines, sensors)
                - General technical assistance
                
                You have access to tools that allow you to perform these actions directly.
                Be helpful, concise, and execute user requests efficiently."""
            }
        ]
        
        # Add history
        for h in request.history:
            messages.append({
                "role": h.get("role", "user"),
                "content": h.get("content", "")
            })
        
        # Add current command
        messages.append({
            "role": "user",
            "content": request.command
        })
        
        # Get AI response with tools
        ai_response = await ai_service.chat_completion(
            user_id=str(current_user.id),
            messages=messages,
            tools=tools,
            max_tokens=1000,
            temperature=0.7
        )
        
        # Handle tool calls if present
        if ai_response.get("tool_calls"):
            tool_results = []
            for tool_call in ai_response["tool_calls"]:
                tool_name = tool_call["name"]
                tool_args = tool_call["arguments"]
                
                if tool_name in tool_functions:
                    # Execute the tool
                    try:
                        result = await tool_functions[tool_name](current_user, **tool_args)
                        tool_results.append(f"[{tool_name}]: {result}")
                    except Exception as e:
                        tool_results.append(f"[{tool_name}]: Error - {str(e)}")
                else:
                    tool_results.append(f"[{tool_name}]: Unknown tool")
            
            response_text = "\n".join(tool_results)
        else:
            response_text = ai_response["response"]
        
        # Calculate execution time
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Determine command type for frontend handling
        command_type = determine_command_type(request.command)
        
        # Build metadata
        metadata = {
            "user_id": str(current_user.id),
            "username": current_user.username,
            "command_type": command_type,
            "agents_used": request.agents,
            "timestamp": start_time.isoformat()
        }
        
        # Send completion update via WebSocket
        if str(current_user.id) in manager.active_connections:
            await manager.send_personal_message(
                json.dumps({
                    "type": "command_complete",
                    "response": response_text,
                    "metadata": metadata
                }),
                str(current_user.id)
            )
        
        return CommandResponse(
            response=response_text,
            command_type=command_type,
            execution_time=execution_time,
            metadata=metadata
        )
        
    except Exception as e:
        logger.error(f"Error processing command: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai-query", response_model=AIQueryResponse)
async def ai_query(
    request: AIQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Handle general AI queries that aren't WIT commands
    """
    try:
        # Use unified AI service for general queries
        ai_response = await ai_service.simple_query(
            user_id=str(current_user.id),
            query=request.query
        )
        
        # Check if we got an error response
        if ai_response.get("error"):
            # Try fallback response
            fallback_response = get_fallback_response(request.query)
            if fallback_response:
                return AIQueryResponse(
                    response=fallback_response,
                    provider="fallback",
                    model="rule-based"
                )
            else:
                return AIQueryResponse(
                    response=ai_response["response"],
                    provider=ai_response["provider"],
                    model=ai_response["model"]
                )
        
        return AIQueryResponse(
            response=ai_response["response"],
            provider=ai_response["provider"],
            model=ai_response["model"],
            tokens_used=ai_response.get("tokens_used")
        )
        
    except Exception as e:
        logger.error(f"Error in AI query: {e}", exc_info=True)
        # Fallback to a simple response for common queries
        fallback_response = get_fallback_response(request.query)
        if fallback_response:
            return AIQueryResponse(
                response=fallback_response,
                provider="fallback",
                model="rule-based"
            )
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get system status and statistics
    """
    try:
        # Check various services
        services = {
            "terminal": True,
            "ai_service": True,  # Unified AI service always available
            "database": True,  # We're here, so DB is working
            "websocket": len(manager.active_connections) > 0
        }
        
        # Get statistics
        stats = {
            "active_connections": len(manager.active_connections),
            "user_count": 1,  # Would query DB in production
            "project_count": 0,  # Would query DB in production
            "uptime_hours": 0  # Would calculate in production
        }
        
        return SystemStatusResponse(
            status="operational" if all(services.values()) else "degraded",
            services=services,
            stats=stats
        )
        
    except Exception as e:
        logger.error(f"Error getting system status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws")
async def terminal_websocket(
    websocket: WebSocket,
    token: str
):
    """
    WebSocket endpoint for real-time terminal communication
    """
    # In production, validate token and get user
    user_id = "test_user"  # Would extract from token
    
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "command":
                # Process command asynchronously
                # In production, this would call process_command
                await websocket.send_text(json.dumps({
                    "type": "command_received",
                    "command": message.get("command")
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logger.info(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        manager.disconnect(user_id)

# Helper functions
def determine_command_type(command: str) -> str:
    """
    Determine the type of command for frontend handling
    """
    command_lower = command.lower()
    
    if any(word in command_lower for word in ["create project", "new project", "start project"]):
        return "project_create"
    elif any(word in command_lower for word in ["list project", "show project", "my project"]):
        return "project_list"
    elif any(word in command_lower for word in ["create file", "new file", "make file"]):
        return "file_create"
    elif any(word in command_lower for word in ["read file", "show file", "open file"]):
        return "file_read"
    elif any(word in command_lower for word in ["write", "save", "update file"]):
        return "file_write"
    elif any(word in command_lower for word in ["delete file", "remove file"]):
        return "file_delete"
    elif any(word in command_lower for word in ["list file", "show file", "ls", "dir"]):
        return "file_list"
    elif any(word in command_lower for word in ["task", "todo"]):
        return "task_management"
    elif any(word in command_lower for word in ["team", "member", "user"]):
        return "team_management"
    elif any(word in command_lower for word in ["equipment", "machine", "printer"]):
        return "equipment_management"
    elif any(word in command_lower for word in ["help", "?"]):
        return "help"
    elif any(word in command_lower for word in ["clear", "cls"]):
        return "clear"
    else:
        return "general"

def get_fallback_response(query: str) -> Optional[str]:
    """
    Get fallback response for common queries when AI is unavailable
    """
    query_lower = query.lower()
    
    # Math queries
    if "square root" in query_lower:
        import re
        import math
        match = re.search(r'(\d+)', query)
        if match:
            num = int(match.group(1))
            return f"The square root of {num} is {math.sqrt(num):.4f}"
    
    # Basic calculations
    try:
        # Safe evaluation for simple math
        if re.match(r'^[\d\s\+\-\*\/\(\)\.]+$', query):
            result = eval(query)
            return f"The result is: {result}"
    except:
        pass
    
    # Common questions
    if "time" in query_lower and "what" in query_lower:
        return f"The current time is {datetime.now().strftime('%I:%M %p')}"
    
    if "date" in query_lower and "what" in query_lower:
        return f"Today's date is {datetime.now().strftime('%B %d, %Y')}"
    
    return None

# Health check
@router.get("/health")
async def health_check():
    """Terminal API health check"""
    return {
        "status": "healthy",
        "service": "terminal_api",
        "timestamp": datetime.now().isoformat()
    }