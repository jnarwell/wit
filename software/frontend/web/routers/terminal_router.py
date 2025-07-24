# software/frontend/web/routers/terminal_router.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from software.backend.services.claude_service import claude_terminal_service
from software.backend.services.database_services import get_session, User
from software.frontend.web.routers.projects_router import get_current_user

router = APIRouter()

class CommandRequest(BaseModel):
    command: str
    history: List[Dict[str, Any]] = []

class CommandResponse(BaseModel):
    response: str

@router.post("/command", response_model=CommandResponse)
async def process_command(
    request: CommandRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Processes a command from the terminal using the Claude service,
    with the current user's context and conversation history.
    """
    response_text = await claude_terminal_service.process_command(
        command_text=request.command,
        history=request.history,
        db=db,
        user=current_user
    )
    return CommandResponse(response=response_text)
