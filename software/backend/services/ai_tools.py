# software/backend/services/ai_tools.py
import os
import json
from datetime import datetime
from typing import List, Dict, Any
from software.frontend.web.routers.files_api import get_user_files, get_projects_files
from software.frontend.web.routers.file_operations_router import (
    get_file_content,
    update_file,
    create_file_or_folder,
    delete_file_or_folder,
    FileUpdateRequest,
    FileOperationRequest,
    get_base_dir,
)
from sqlalchemy import select
from software.backend.services.database_services import User, get_session
from software.frontend.web.routers.files_api import get_file_structure

# --- File System Tools ---

async def list_files(user: User, path: str, base_dir: str, project_id: str = None, **kwargs) -> str:
    """Lists files and directories at a given path."""
    async for db in get_session():
        base_path = get_base_dir(base_dir, user, project_id)
        full_path = os.path.join(base_path, path)
        
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_path)):
            return "Error: Access denied."
            
        structure = get_file_structure(full_path)
        return json.dumps([node.dict() for node in structure], indent=2)

async def read_file(user: User, path: str, base_dir: str, project_id: str = None) -> str:
    """Reads the content of a file."""
    response = await get_file_content(path=path, base_dir=base_dir, project_id=project_id, current_user=user)
    return response.content

async def write_file(user: User, path: str, content: str, base_dir: str, project_id: str = None) -> str:
    """Writes content to a file."""
    request = FileUpdateRequest(path=path, content=content, base_dir=base_dir, project_id=project_id)
    response = await update_file(data=request, current_user=user)
    return response["message"]

async def create_file(user: User, path: str, base_dir: str, project_id: str = None) -> str:
    """Creates a new file."""
    request = FileOperationRequest(path=path, base_dir=base_dir, project_id=project_id)
    response = await create_file_or_folder(data=request, current_user=user)
    return response["message"]

async def delete_file(user: User, path: str, base_dir: str, project_id: str = None) -> str:
    """Deletes a file."""
    base_path = get_base_dir(base_dir, user, project_id)
    full_path = os.path.join(base_path, path)

    if not os.path.exists(full_path):
        return "Error: File not found."

    request = FileOperationRequest(path=path, base_dir=base_dir, project_id=project_id)
    response = await delete_file_or_folder(data=request, current_user=user)
    return response["message"]


from software.backend.api.equipment_api import get_printers, get_printer_status, send_gcode, GCodeRequest

# ... (existing code) ...

# --- Equipment Tools ---

async def get_equipment_status() -> str:
    """Gets the status of all connected equipment."""
    printers = await get_printers()
    return json.dumps(printers, indent=2)

async def run_equipment_command(equipment_id: str, command: str) -> str:
    """Runs a command on a piece of equipment."""
    if "gcode" in command.lower():
        # For now, we only support G-code commands
        gcode_command = command.split("gcode")[-1].strip()
        request = GCodeRequest(printer_id=equipment_id, commands=[gcode_command])
        response = await send_gcode(request)
        return response["message"]
    else:
        return "Only G-code commands are supported at this time."


# --- Log Tools ---

def search_logs(query: str) -> str:
    """Searches the AI conversation logs."""
    log_file_path = "storage/WIT_LOG.md"
    try:
        with open(log_file_path, "r") as f:
            logs = f.read()
        
        results = []
        for entry in logs.split("---"):
            if query.lower() in entry.lower():
                results.append(entry.strip())
        
        if not results:
            return "No matching log entries found."
            
        return "\n\n".join(results)
    except FileNotFoundError:
        return "Log file not found."
    except Exception as e:
        return f"An error occurred while searching the logs: {e}"

# --- Tool Definitions ---

tools = [
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
    {
        "name": "get_equipment_status",
        "description": "Gets the status of all connected equipment.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "run_equipment_command",
        "description": "Runs a command on a piece of equipment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "equipment_id": {"type": "string", "description": "The ID of the equipment to run the command on."},
                "command": {"type": "string", "description": "The command to run."}
            },
            "required": ["equipment_id", "command"]
        }
    },
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

tool_functions = {
    "list_files": list_files,
    "read_file": read_file,
    "write_file": write_file,
    "create_file": create_file,
    "delete_file": delete_file,
    "get_equipment_status": get_equipment_status,
    "run_equipment_command": run_equipment_command,
    "search_logs": search_logs
}
