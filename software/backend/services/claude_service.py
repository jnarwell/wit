# software/backend/services/claude_service.py
import os
import logging
import json
import uuid
from typing import List, Dict, Any
import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from services.database_services import User, Project, TeamMember, Equipment
from services.ai_tools import (
    list_files,
    read_file,
    write_file,
    create_file,
    delete_file,
    get_equipment_status,
    run_equipment_command,
    search_logs
)
from services.ai_project_tools import (
    create_task,
    list_tasks,
    update_task,
    delete_task,
    add_team_member,
    list_team_members,
    remove_team_member,
    get_project_stats,
    get_project_details,
    search_projects
)

logger = logging.getLogger(__name__)

# --- Tool Definitions ---
tools = [
    # Project Tools
    {"name": "create_project", "description": "Creates a new project.", "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "description": {"type": "string"}}, "required": ["name", "description"]}},
    {"name": "list_projects", "description": "Lists all projects for the user.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "update_project", "description": "Updates a project.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}, "name": {"type": "string"}, "description": {"type": "string"}}, "required": ["project_id"]}},
    {"name": "delete_project", "description": "Deletes a project.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}}, "required": ["project_id"]}},
    {"name": "get_project_details", "description": "Get detailed information about a project including recent activity.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}}, "required": ["project_id"]}},
    {"name": "get_project_stats", "description": "Get comprehensive statistics for a project including task progress, member count, and file count.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}}, "required": ["project_id"]}},
    {"name": "search_projects", "description": "Search for projects by name or description.", "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    
    # Task Management Tools
    {"name": "create_task", "description": "Create a new task in a project.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}, "name": {"type": "string"}, "description": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "medium", "high"]}, "assigned_to": {"type": "string"}, "due_date": {"type": "string", "description": "ISO format date"}}, "required": ["project_id", "name"]}},
    {"name": "list_tasks", "description": "List tasks in a project with optional filters.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}, "status": {"type": "string", "enum": ["pending", "in_progress", "completed", "cancelled"]}, "assigned_to": {"type": "string"}}, "required": ["project_id"]}},
    {"name": "update_task", "description": "Update a task's properties.", "input_schema": {"type": "object", "properties": {"task_id": {"type": "string"}, "status": {"type": "string", "enum": ["pending", "in_progress", "completed", "cancelled"]}, "priority": {"type": "string", "enum": ["low", "medium", "high"]}, "assigned_to": {"type": "string"}, "name": {"type": "string"}, "description": {"type": "string"}}, "required": ["task_id"]}},
    {"name": "delete_task", "description": "Delete a task.", "input_schema": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"]}},
    
    # Team Member Tools
    {"name": "add_team_member", "description": "Add a team member to a project.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}, "username": {"type": "string"}, "role": {"type": "string", "enum": ["viewer", "editor", "admin"]}}, "required": ["project_id", "username"]}},
    {"name": "list_team_members", "description": "List all team members of a project.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}}, "required": ["project_id"]}},
    {"name": "remove_team_member", "description": "Remove a team member from a project.", "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}, "username": {"type": "string"}}, "required": ["project_id", "username"]}},
    # Equipment Tools
    {"name": "create_equipment", "description": "Adds a new piece of equipment.", "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "type": {"type": "string", "description": "e.g., 3d_printer, laser_cutter"}}, "required": ["name", "type"]}},
    {"name": "list_equipment", "description": "Lists all equipment for the user.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "delete_equipment", "description": "Deletes a piece of equipment.", "input_schema": {"type": "object", "properties": {"equipment_id": {"type": "string"}}, "required": ["equipment_id"]}},
    {"name": "get_equipment_status", "description": "Gets the status of a piece of equipment.", "input_schema": {"type": "object", "properties": {"equipment_id": {"type": "string"}}, "required": ["equipment_id"]}},
    # File System Tools
    {
        "name": "list_files",
        "description": "Lists files and directories at a given path.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "The path to list files in."},
                "base_dir": {"type": "string", "description": "The base directory ('user' or 'project')."},
                "project_id": {"type": "string", "description": "The project ID, if applicable."}
            },
            "required": ["path", "base_dir"]
        }
    },
    {
        "name": "read_file",
        "description": "Reads the content of a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "The path of the file to read."},
                "base_dir": {"type": "string", "description": "The base directory ('user' or 'project')."},
                "project_id": {"type": "string", "description": "The project ID, if applicable."}
            },
            "required": ["path", "base_dir"]
        }
    },
    {
        "name": "write_file",
        "description": "Writes content to a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "The path of the file to write to."},
                "content": {"type": "string", "description": "The content to write to the file."},
                "base_dir": {"type": "string", "description": "The base directory ('user' or 'project')."},
                "project_id": {"type": "string", "description": "The project ID, if applicable."}
            },
            "required": ["path", "content", "base_dir"]
        }
    },
    {
        "name": "create_file",
        "description": "Creates a new file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "The path of the file to create."},
                "base_dir": {"type": "string", "description": "The base directory ('user' or 'project')."},
                "project_id": {"type": "string", "description": "The project ID, if applicable."}
            },
            "required": ["path", "base_dir"]
        }
    },
    {
        "name": "delete_file",
        "description": "Deletes a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "The path of the file to delete."},
                "base_dir": {"type": "string", "description": "The base directory ('user' or 'project')."},
                "project_id": {"type": "string", "description": "The project ID, if applicable."}
            },
            "required": ["path", "base_dir"]
        }
    },
    # Log Tools
    {
        "name": "search_logs",
        "description": "Searches the AI conversation logs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The query to search for in the logs."}
            },
            "required": ["query"]
        }
    }
]

# --- Tool Implementations ---
async def create_project(db: AsyncSession, user: User, name: str, description: str):
    new_project = Project(project_id=f"PROJ-{uuid.uuid4().hex[:8].upper()}", name=name, description=description, owner_id=user.id, status="planning", type="generic")
    db.add(new_project)
    await db.flush()
    db.add(TeamMember(project_id=new_project.id, user_id=user.id, role="owner"))
    
    # Create a corresponding folder for the project
    project_dir = os.path.join("storage", "projects", new_project.project_id)
    os.makedirs(project_dir, exist_ok=True)
    
    await db.commit()
    return {"status": "success", "project_id": new_project.project_id, "name": name}

async def list_projects(db: AsyncSession, user: User):
    result = await db.execute(select(Project).where(Project.owner_id == user.id))
    projects = result.scalars().all()
    return {"projects": [{"name": p.name, "id": p.project_id, "description": p.description} for p in projects]}

async def update_project(db: AsyncSession, user: User, project_id: str, name: str = None, description: str = None):
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project: return {"status": "error", "message": "Project not found."}
    if project.owner_id != user.id: return {"status": "error", "message": "You are not authorized to update this project."}
    if name: project.name = name
    if description: project.description = description
    await db.commit()
    return {"status": "success", "project_id": project.project_id}

async def delete_project(db: AsyncSession, user: User, project_id: str):
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project: return {"status": "error", "message": "Project not found."}
    if project.owner_id != user.id: return {"status": "error", "message": "You are not authorized to delete this project."}
    await db.execute(delete(TeamMember).where(TeamMember.project_id == project.id))
    await db.delete(project)
    await db.commit()
    return {"status": "success", "project_id": project_id}

async def create_equipment(db: AsyncSession, user: User, name: str, type: str):
    new_equipment = Equipment(equipment_id=f"EQ-{uuid.uuid4().hex[:8].upper()}", name=name, type=type, owner_id=user.id)
    db.add(new_equipment)
    await db.commit()
    return {"status": "success", "equipment_id": new_equipment.equipment_id}

async def list_equipment(db: AsyncSession, user: User):
    result = await db.execute(select(Equipment).where(Equipment.owner_id == user.id))
    equipment = result.scalars().all()
    return {"equipment": [{"name": e.name, "id": e.equipment_id, "type": e.type, "status": e.status} for e in equipment]}

async def delete_equipment(db: AsyncSession, user: User, equipment_id: str):
    result = await db.execute(select(Equipment).where(Equipment.equipment_id == equipment_id))
    equipment = result.scalar_one_or_none()
    if not equipment: return {"status": "error", "message": "Equipment not found."}
    if equipment.owner_id != user.id: return {"status": "error", "message": "Not authorized."}
    await db.delete(equipment)
    await db.commit()
    return {"status": "success", "equipment_id": equipment_id}

async def get_equipment_status(db: AsyncSession, user: User, equipment_id: str):
    result = await db.execute(select(Equipment).where(Equipment.equipment_id == equipment_id))
    equipment = result.scalar_one_or_none()
    if not equipment: return {"status": "error", "message": "Equipment not found."}
    return {"id": equipment.equipment_id, "name": equipment.name, "status": equipment.status}

class ClaudeTerminalService:
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.client = anthropic.AsyncAnthropic(api_key=self.api_key) if self.api_key else None

    async def process_command(self, command_text: str, history: List[Dict[str, Any]], db: AsyncSession, user: User) -> str:
        if not self.client: return "Error: Claude API key not configured."
        
        system_prompt = """You are WIT, an AI assistant in a command-line terminal for a comprehensive project management system. You have full control over projects, tasks, and team management.

Your capabilities include:
- Project Management: Create, update, delete projects, get project details and statistics
- Task Management: Create, update, delete, and list tasks with priorities and assignments
- Team Management: Add/remove team members, assign roles (viewer, editor, admin)
- File Management: Read, write, create, and delete files in user and project directories
- Equipment Management: Track and control workshop equipment
- Analytics: Get project progress, task completion rates, and team statistics

When users ask about project status, provide comprehensive information including task progress, team members, and recent activity. Be proactive in offering helpful suggestions for project management.

When a user asks to perform an action, think about which tool to use and respond with the tool call. If no specific tool is required, provide a direct, helpful, conversational response."""
        messages = history[:-1] + [{"role": "user", "content": command_text}]

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20240620", max_tokens=4096, system=system_prompt,
                messages=messages, tools=tools, tool_choice={"type": "auto"}
            )
            response_message = response.content[-1]

            if response_message.type == "tool_use":
                tool_name, tool_input, tool_use_id = response_message.name, response_message.input, response_message.id
                
                if tool_name == "create_project":
                    tool_result = await create_project(db, user, **tool_input)
                elif tool_name == "list_projects":
                    tool_result = await list_projects(db, user)
                elif tool_name == "update_project":
                    tool_result = await update_project(db, user, **tool_input)
                elif tool_name == "delete_project":
                    tool_result = await delete_project(db, user, **tool_input)
                elif tool_name == "create_equipment":
                    tool_result = await create_equipment(db, user, **tool_input)
                elif tool_name == "list_equipment":
                    tool_result = await list_equipment(db, user)
                elif tool_name == "delete_equipment":
                    tool_result = await delete_equipment(db, user, **tool_input)
                elif tool_name == "get_equipment_status": tool_result = await get_equipment_status(db, user, **tool_input)
                # Task Management
                elif tool_name == "create_task":
                    tool_result = await create_task(db, user, **tool_input)
                elif tool_name == "list_tasks":
                    tool_result = await list_tasks(db, user, **tool_input)
                elif tool_name == "update_task":
                    tool_result = await update_task(db, user, **tool_input)
                elif tool_name == "delete_task":
                    tool_result = await delete_task(db, user, **tool_input)
                # Team Member Management
                elif tool_name == "add_team_member":
                    tool_result = await add_team_member(db, user, **tool_input)
                elif tool_name == "list_team_members":
                    tool_result = await list_team_members(db, user, **tool_input)
                elif tool_name == "remove_team_member":
                    tool_result = await remove_team_member(db, user, **tool_input)
                # Project Analytics
                elif tool_name == "get_project_details":
                    tool_result = await get_project_details(db, user, **tool_input)
                elif tool_name == "get_project_stats":
                    tool_result = await get_project_stats(db, user, **tool_input)
                elif tool_name == "search_projects":
                    tool_result = await search_projects(db, user, **tool_input)
                # File Management
                elif tool_name == "list_files": tool_result = await list_files(user=user, **tool_input)
                elif tool_name == "read_file": tool_result = await read_file(user=user, **tool_input)
                elif tool_name == "write_file": tool_result = await write_file(user=user, **tool_input)
                elif tool_name == "create_file": tool_result = await create_file(user=user, **tool_input)
                elif tool_name == "delete_file": tool_result = await delete_file(user=user, **tool_input)
                elif tool_name == "run_equipment_command": tool_result = await run_equipment_command(**tool_input)
                elif tool_name == "search_logs": tool_result = await search_logs(**tool_input)
                else: tool_result = {"status": "error", "message": f"Unknown tool: {tool_name}"}

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": json.dumps(tool_result)}]})

                final_response = await self.client.messages.create(
                    model="claude-3-5-sonnet-20240620", max_tokens=4096, system=system_prompt,
                    messages=messages, tools=tools
                )
                return final_response.content[0].text
            else:
                return response_message.text
        except Exception as e:
            logger.error(f"Error processing command with Claude: {e}", exc_info=True)
            return f"Error: Could not process the command. Details: {e}"

claude_terminal_service = ClaudeTerminalService()
