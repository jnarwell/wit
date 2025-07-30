# software/backend/services/ai_tools.py
import os
import json
from datetime import datetime
from typing import List, Dict, Any
from software.frontend.web.routers.files_api import get_user_files, get_projects_files, build_tree
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
from services.database_services import User, get_session

# --- File System Tools ---

async def list_files(user: User, path: str, base_dir: str, project_id: str = None, **kwargs) -> str:
    """Lists files and directories at a given path."""
    async for db in get_session():
        base_path = get_base_dir(base_dir, user, project_id)
        full_path = os.path.join(base_path, path)
        
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_path)):
            return "Error: Access denied."
            
        structure = build_tree(full_path)
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


# Import equipment API functions if available
try:
    from api.equipment_api import get_printers, get_printer_status, send_gcode, GCodeRequest
    EQUIPMENT_API_AVAILABLE = True
except ImportError:
    EQUIPMENT_API_AVAILABLE = False
    get_printers = None
    get_printer_status = None
    send_gcode = None
    GCodeRequest = None

# ... (existing code) ...

# --- Equipment Tools ---

async def get_equipment_status() -> str:
    """Gets the status of all connected equipment."""
    if not EQUIPMENT_API_AVAILABLE:
        return "Equipment API not available"
    printers = await get_printers()
    return json.dumps(printers, indent=2)

async def run_equipment_command(equipment_id: str, command: str) -> str:
    """Runs a command on a piece of equipment."""
    if not EQUIPMENT_API_AVAILABLE:
        return "Equipment API not available"
    if "gcode" in command.lower():
        # For now, we only support G-code commands
        gcode_command = command.split("gcode")[-1].strip()
        request = GCodeRequest(printer_id=equipment_id, commands=[gcode_command])
        response = await send_gcode(request)
        return response["message"]
    else:
        return "Only G-code commands are supported at this time."


# --- Project Management Tools ---

async def list_projects(user: User) -> str:
    """Lists all projects for the current user."""
    async for db in get_session():
        from services.database_services import Project
        result = await db.execute(
            select(Project).where(Project.owner_id == user.id)
        )
        projects = result.scalars().all()
        
        project_list = []
        for p in projects:
            project_list.append({
                "id": p.project_id,
                "name": p.name,
                "description": p.description,
                "status": p.status,
                "priority": p.extra_data.get("priority", "medium") if p.extra_data else "medium",
                "created_at": p.created_at.isoformat() if p.created_at else None
            })
        
        if not project_list:
            return "No projects found."
        
        return json.dumps(project_list, indent=2)

async def create_project(user: User, name: str, description: str = "", priority: str = "medium") -> str:
    """Creates a new project."""
    async for db in get_session():
        from services.database_services import Project
        import uuid
        
        # Generate project ID
        project_id = f"PROJ-{uuid.uuid4().hex[:8].upper()}"
        
        new_project = Project(
            project_id=project_id,
            name=name,
            description=description,
            status="not_started",
            owner_id=user.id,
            extra_data={"priority": priority}
        )
        
        db.add(new_project)
        await db.commit()
        
        return f"Project '{name}' created successfully with ID: {project_id}"

async def update_project(user: User, project_id: str, name: str = None, description: str = None, status: str = None, priority: str = None) -> str:
    """Updates an existing project."""
    async for db in get_session():
        from services.database_services import Project
        
        result = await db.execute(
            select(Project).where(
                Project.project_id == project_id,
                Project.owner_id == user.id
            )
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return f"Project {project_id} not found."
        
        if name:
            project.name = name
        if description is not None:
            project.description = description
        if status:
            project.status = status
        if priority:
            if not project.extra_data:
                project.extra_data = {}
            project.extra_data["priority"] = priority
        
        project.updated_at = datetime.utcnow()
        await db.commit()
        
        return f"Project {project_id} updated successfully."

async def delete_project(user: User, project_id: str) -> str:
    """Deletes a project."""
    async for db in get_session():
        from services.database_services import Project
        
        result = await db.execute(
            select(Project).where(
                Project.project_id == project_id,
                Project.owner_id == user.id
            )
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return f"Project {project_id} not found."
        
        await db.delete(project)
        await db.commit()
        
        return f"Project {project_id} deleted successfully."

# --- Task Management Tools ---

async def list_tasks(user: User, project_id: str = None, status: str = None) -> str:
    """Lists tasks, optionally filtered by project or status."""
    async for db in get_session():
        from services.database_services import Task, Project
        
        query = select(Task, Project).join(Project, Task.project_id == Project.id)
        
        if project_id:
            query = query.where(Project.project_id == project_id)
        
        query = query.where(Project.owner_id == user.id)
        
        if status:
            query = query.where(Task.status == status)
        
        result = await db.execute(query)
        tasks_with_projects = result.all()
        
        task_list = []
        for task, project in tasks_with_projects:
            task_list.append({
                "id": str(task.id),
                "name": task.name,
                "description": task.description,
                "status": task.status,
                "priority": task.priority,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "project_id": project.project_id,
                "project_name": project.name
            })
        
        if not task_list:
            return "No tasks found."
        
        return json.dumps(task_list, indent=2)

async def create_task(user: User, project_id: str, name: str, description: str = "", priority: str = "medium", due_date: str = None) -> str:
    """Creates a new task in a project."""
    async for db in get_session():
        from services.database_services import Task, Project
        
        # Find the project
        result = await db.execute(
            select(Project).where(
                Project.project_id == project_id,
                Project.owner_id == user.id
            )
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return f"Project {project_id} not found."
        
        # Parse due date if provided
        due_date_obj = None
        if due_date:
            try:
                due_date_obj = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            except:
                return "Invalid due date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)."
        
        new_task = Task(
            name=name,
            description=description,
            status="not_started",
            priority=priority,
            due_date=due_date_obj,
            project_id=project.id
        )
        
        db.add(new_task)
        await db.commit()
        
        return f"Task '{name}' created successfully in project {project_id}."

async def update_task(user: User, task_id: str, name: str = None, description: str = None, status: str = None, priority: str = None, due_date: str = None) -> str:
    """Updates a task."""
    async for db in get_session():
        from services.database_services import Task, Project
        import uuid
        
        # Parse task_id as UUID
        try:
            task_uuid = uuid.UUID(task_id)
        except:
            return f"Invalid task ID format: {task_id}"
        
        # Find the task with ownership check
        result = await db.execute(
            select(Task, Project)
            .join(Project, Task.project_id == Project.id)
            .where(Task.id == task_uuid, Project.owner_id == user.id)
        )
        task_result = result.first()
        
        if not task_result:
            return f"Task {task_id} not found."
        
        task, project = task_result
        
        if name:
            task.name = name
        if description is not None:
            task.description = description
        if status:
            task.status = status
        if priority:
            task.priority = priority
        if due_date is not None:
            if due_date == "":
                task.due_date = None
            else:
                try:
                    task.due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                except:
                    return "Invalid due date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)."
        
        task.updated_at = datetime.utcnow()
        await db.commit()
        
        return f"Task {task_id} updated successfully."

async def delete_task(user: User, task_id: str) -> str:
    """Deletes a task."""
    async for db in get_session():
        from services.database_services import Task, Project
        import uuid
        
        # Parse task_id as UUID
        try:
            task_uuid = uuid.UUID(task_id)
        except:
            return f"Invalid task ID format: {task_id}"
        
        # Find the task with ownership check
        result = await db.execute(
            select(Task, Project)
            .join(Project, Task.project_id == Project.id)
            .where(Task.id == task_uuid, Project.owner_id == user.id)
        )
        task_result = result.first()
        
        if not task_result:
            return f"Task {task_id} not found."
        
        task, project = task_result
        
        await db.delete(task)
        await db.commit()
        
        return f"Task {task_id} deleted successfully."

# --- Team Member Management Tools ---

async def list_team_members(user: User, project_id: str) -> str:
    """Lists team members for a project."""
    async for db in get_session():
        from services.database_services import TeamMember, Project, User as DBUser
        
        # Find the project
        result = await db.execute(
            select(Project).where(
                Project.project_id == project_id,
                Project.owner_id == user.id
            )
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return f"Project {project_id} not found."
        
        # Get team members
        result = await db.execute(
            select(TeamMember, DBUser)
            .join(DBUser, TeamMember.user_id == DBUser.id)
            .where(TeamMember.project_id == project.id)
        )
        members = result.all()
        
        member_list = []
        for member, user_obj in members:
            member_list.append({
                "username": user_obj.username,
                "email": user_obj.email,
                "role": member.role
            })
        
        if not member_list:
            return f"No team members found for project {project_id}."
        
        return json.dumps(member_list, indent=2)

async def add_team_member(user: User, project_id: str, username: str, role: str = "viewer") -> str:
    """Adds a team member to a project."""
    async for db in get_session():
        from services.database_services import TeamMember, Project, User as DBUser
        
        # Find the project
        result = await db.execute(
            select(Project).where(
                Project.project_id == project_id,
                Project.owner_id == user.id
            )
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return f"Project {project_id} not found."
        
        # Find the user to add
        result = await db.execute(
            select(DBUser).where(DBUser.username == username)
        )
        member_user = result.scalar_one_or_none()
        
        if not member_user:
            return f"User {username} not found."
        
        # Check if already a member
        result = await db.execute(
            select(TeamMember).where(
                TeamMember.project_id == project.id,
                TeamMember.user_id == member_user.id
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            return f"User {username} is already a member of project {project_id}."
        
        # Add the member
        new_member = TeamMember(
            project_id=project.id,
            user_id=member_user.id,
            role=role
        )
        
        db.add(new_member)
        await db.commit()
        
        return f"User {username} added to project {project_id} as {role}."

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

# --- Equipment Management Tools ---

async def list_equipment(user: User) -> str:
    """Lists all equipment (machines, sensors, printers)."""
    equipment_list = []
    
    # Get printers from equipment API
    printers = await get_printers()
    for printer in printers:
        equipment_list.append({
            "type": "printer",
            "id": printer["id"],
            "name": printer["name"],
            "status": printer["status"]
        })
    
    # Get machines from localStorage (simulated)
    equipment_list.append({
        "type": "machine",
        "id": "MACH-001",
        "name": "3D Printer Alpha",
        "status": "idle"
    })
    
    # Get sensors
    equipment_list.append({
        "type": "sensor",
        "id": "SENS-001",
        "name": "Temperature Sensor Lab",
        "status": "active"
    })
    
    if not equipment_list:
        return "No equipment found."
    
    return json.dumps(equipment_list, indent=2)

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
    },
    {
        "name": "list_projects",
        "description": "Lists all projects for the current user.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "create_project",
        "description": "Creates a new project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "The name of the project."},
                "description": {"type": "string", "description": "The project description."},
                "priority": {"type": "string", "description": "Priority level (low, medium, high, critical)."}
            },
            "required": ["name"]
        }
    },
    {
        "name": "update_project",
        "description": "Updates an existing project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "The project ID to update."},
                "name": {"type": "string", "description": "New project name."},
                "description": {"type": "string", "description": "New project description."},
                "status": {"type": "string", "description": "New status (not_started, in_progress, blocked, complete)."},
                "priority": {"type": "string", "description": "New priority (low, medium, high, critical)."}
            },
            "required": ["project_id"]
        }
    },
    {
        "name": "delete_project",
        "description": "Deletes a project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "The project ID to delete."}
            },
            "required": ["project_id"]
        }
    },
    {
        "name": "list_tasks",
        "description": "Lists tasks, optionally filtered by project or status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "Filter by project ID."},
                "status": {"type": "string", "description": "Filter by status (not_started, in_progress, blocked, complete)."}
            }
        }
    },
    {
        "name": "create_task",
        "description": "Creates a new task in a project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "The project ID to add the task to."},
                "name": {"type": "string", "description": "The task name."},
                "description": {"type": "string", "description": "The task description."},
                "priority": {"type": "string", "description": "Priority (low, medium, high)."},
                "due_date": {"type": "string", "description": "Due date in ISO format (YYYY-MM-DD)."}
            },
            "required": ["project_id", "name"]
        }
    },
    {
        "name": "update_task",
        "description": "Updates a task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task ID to update."},
                "name": {"type": "string", "description": "New task name."},
                "description": {"type": "string", "description": "New task description."},
                "status": {"type": "string", "description": "New status (not_started, in_progress, blocked, complete)."},
                "priority": {"type": "string", "description": "New priority (low, medium, high)."},
                "due_date": {"type": "string", "description": "New due date in ISO format."}
            },
            "required": ["task_id"]
        }
    },
    {
        "name": "delete_task",
        "description": "Deletes a task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task ID to delete."}
            },
            "required": ["task_id"]
        }
    },
    {
        "name": "list_team_members",
        "description": "Lists team members for a project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "The project ID."}
            },
            "required": ["project_id"]
        }
    },
    {
        "name": "add_team_member",
        "description": "Adds a team member to a project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "The project ID."},
                "username": {"type": "string", "description": "The username to add."},
                "role": {"type": "string", "description": "Role (viewer, editor, admin)."}
            },
            "required": ["project_id", "username"]
        }
    },
    {
        "name": "list_equipment",
        "description": "Lists all equipment (machines, sensors, printers).",
        "input_schema": {"type": "object", "properties": {}}
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
    "search_logs": search_logs,
    "list_projects": list_projects,
    "create_project": create_project,
    "update_project": update_project,
    "delete_project": delete_project,
    "list_tasks": list_tasks,
    "create_task": create_task,
    "update_task": update_task,
    "delete_task": delete_task,
    "list_team_members": list_team_members,
    "add_team_member": add_team_member,
    "list_equipment": list_equipment
}
