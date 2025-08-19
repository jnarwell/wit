# WIT AI Commands Reference

This document lists all available commands that the WIT AI assistant can use to interact with the system.

## Project Management Commands

### list_projects
Lists all projects for the current user.
- **Usage**: "Show me all my projects" or "List projects"
- **Returns**: JSON list of projects with ID, name, description, status, priority

### create_project
Creates a new project.
- **Parameters**:
  - `name` (required): Project name
  - `description` (optional): Project description
  - `priority` (optional): Priority level (low, medium, high, critical)
- **Usage**: "Create a new project called Smart Home Hub with high priority"
- **Returns**: Success message with project ID

### update_project
Updates an existing project.
- **Parameters**:
  - `project_id` (required): The project ID to update
  - `name` (optional): New project name
  - `description` (optional): New description
  - `status` (optional): New status (not_started, in_progress, blocked, complete)
  - `priority` (optional): New priority
- **Usage**: "Update project PROJ-123 status to in_progress"
- **Returns**: Success confirmation

### delete_project
Deletes a project.
- **Parameters**:
  - `project_id` (required): The project ID to delete
- **Usage**: "Delete project PROJ-123"
- **Returns**: Success confirmation

## Task Management Commands

### list_tasks
Lists tasks, optionally filtered by project or status.
- **Parameters**:
  - `project_id` (optional): Filter by project
  - `status` (optional): Filter by status
- **Usage**: "Show all tasks in project PROJ-123" or "List all blocked tasks"
- **Returns**: JSON list of tasks with details

### create_task
Creates a new task in a project.
- **Parameters**:
  - `project_id` (required): The project to add task to
  - `name` (required): Task name
  - `description` (optional): Task description
  - `priority` (optional): Priority (low, medium, high)
  - `due_date` (optional): Due date in ISO format (YYYY-MM-DD)
- **Usage**: "Create a task 'Review PCB design' in project PROJ-123 with high priority due tomorrow"
- **Returns**: Success confirmation

### update_task
Updates a task.
- **Parameters**:
  - `task_id` (required): The task ID to update
  - `name` (optional): New name
  - `description` (optional): New description
  - `status` (optional): New status (not_started, in_progress, blocked, complete)
  - `priority` (optional): New priority
  - `due_date` (optional): New due date
- **Usage**: "Mark task 12345 as complete"
- **Returns**: Success confirmation

### delete_task
Deletes a task.
- **Parameters**:
  - `task_id` (required): The task ID to delete
- **Usage**: "Delete task 12345"
- **Returns**: Success confirmation

## Team Management Commands

### list_team_members
Lists team members for a project.
- **Parameters**:
  - `project_id` (required): The project ID
- **Usage**: "Show team members for project PROJ-123"
- **Returns**: JSON list of team members with roles

### add_team_member
Adds a team member to a project.
- **Parameters**:
  - `project_id` (required): The project ID
  - `username` (required): Username to add
  - `role` (optional): Role (viewer, editor, admin)
- **Usage**: "Add john_doe as editor to project PROJ-123"
- **Returns**: Success confirmation

## File Management Commands

### list_files
Lists files and directories at a given path.
- **Parameters**:
  - `path` (required): The path to list
  - `base_dir` (required): 'user' or 'project'
  - `project_id` (optional): Required if base_dir is 'project'
- **Usage**: "List files in my home directory" or "Show files in project PROJ-123"
- **Returns**: JSON tree structure of files

### read_file
Reads the content of a file.
- **Parameters**:
  - `path` (required): File path to read
  - `base_dir` (required): 'user' or 'project'
  - `project_id` (optional): Required if base_dir is 'project'
- **Usage**: "Read the README.md file"
- **Returns**: File content

### write_file
Writes content to a file.
- **Parameters**:
  - `path` (required): File path to write
  - `content` (required): Content to write
  - `base_dir` (required): 'user' or 'project'
  - `project_id` (optional): Required if base_dir is 'project'
- **Usage**: "Write 'Hello World' to test.txt"
- **Returns**: Success confirmation

### create_file
Creates a new file.
- **Parameters**:
  - `path` (required): File path to create
  - `base_dir` (required): 'user' or 'project'
  - `project_id` (optional): Required if base_dir is 'project'
- **Usage**: "Create a new file called notes.txt"
- **Returns**: Success confirmation

### delete_file
Deletes a file.
- **Parameters**:
  - `path` (required): File path to delete
  - `base_dir` (required): 'user' or 'project'
  - `project_id` (optional): Required if base_dir is 'project'
- **Usage**: "Delete the temp.txt file"
- **Returns**: Success confirmation

## Equipment Management Commands

### list_equipment
Lists all equipment (machines, sensors, printers).
- **Usage**: "Show all equipment" or "List available machines"
- **Returns**: JSON list of equipment with type, ID, name, and status

### get_equipment_status
Gets the status of all connected equipment.
- **Usage**: "What's the status of all equipment?"
- **Returns**: Detailed status information

### run_equipment_command
Runs a command on a piece of equipment.
- **Parameters**:
  - `equipment_id` (required): Equipment ID
  - `command` (required): Command to run (currently only G-code supported)
- **Usage**: "Send G-code G28 to printer PRINT-001"
- **Returns**: Command execution result

## Utility Commands

### search_logs
Searches the AI conversation logs.
- **Parameters**:
  - `query` (required): Search query
- **Usage**: "Search logs for temperature sensor"
- **Returns**: Matching log entries

## Example Conversations

1. **Project Setup**:
   - "Create a new project called Weather Station with high priority"
   - "Add tasks for PCB design, firmware development, and testing"
   - "Set the PCB design task due date to next Friday"

2. **Task Management**:
   - "Show me all tasks due this week"
   - "Update the firmware task status to in_progress"
   - "List all blocked tasks across all projects"

3. **Team Collaboration**:
   - "Add sarah_jones as an editor to the Weather Station project"
   - "Show all team members for project PROJ-123"

4. **File Operations**:
   - "Create a new file called sensor_readings.csv in the Weather Station project"
   - "Read the configuration file config.json"
   - "List all files in the project directory"

5. **Equipment Control**:
   - "What's the status of the 3D printer?"
   - "Send home command (G28) to printer PRINT-001"

## Tips for Natural Language Commands

The WIT AI understands natural language, so you can phrase commands conversationally:
- Instead of "list_projects", say "Show me my projects"
- Instead of "create_task", say "Add a new task to..."
- Instead of "update_task status complete", say "Mark the task as done"

The AI will interpret your intent and use the appropriate commands.