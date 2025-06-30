"""
W.I.T. Workspace API Router

File: software/backend/api/workspace_api.py

High-level workspace management and orchestration endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Tuple
import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
import json

# Import services
import sys
sys.path.append('..')
from services.auth_service import get_current_user
from services.event_service import EventService

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])

# Workspace state
workspace_state = {
    "mode": "manual",  # manual, semi-auto, auto
    "active_workflows": {},
    "active_projects": {},
    "safety_status": "safe",
    "activity_level": "idle"
}


# Enums
class WorkspaceMode(str, Enum):
    MANUAL = "manual"
    SEMI_AUTO = "semi-auto"
    AUTO = "auto"


class WorkflowStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class ProjectType(str, Enum):
    PRINTING_3D = "3d_printing"
    CNC_MACHINING = "cnc_machining"
    LASER_CUTTING = "laser_cutting"
    PCB_ASSEMBLY = "pcb_assembly"
    GENERAL = "general"


# Request/Response Models
class WorkspaceConfig(BaseModel):
    """Workspace configuration"""
    mode: WorkspaceMode = WorkspaceMode.MANUAL
    safety_checks_enabled: bool = True
    auto_tool_selection: bool = False
    voice_confirmations: bool = True
    vision_monitoring: bool = True
    emergency_stop_enabled: bool = True


class Project(BaseModel):
    """Workshop project"""
    id: str
    name: str
    type: ProjectType
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    status: str = "active"
    files: List[str] = Field(default_factory=list)
    equipment: List[str] = Field(default_factory=list)
    materials: Dict[str, Any] = Field(default_factory=dict)
    progress: float = 0.0


class Workflow(BaseModel):
    """Automated workflow"""
    id: str
    name: str
    project_id: Optional[str] = None
    steps: List[Dict[str, Any]]
    current_step: int = 0
    status: WorkflowStatus = WorkflowStatus.IDLE
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


class MaterialInventory(BaseModel):
    """Material inventory item"""
    material_id: str
    name: str
    type: str  # filament, wood, metal, etc.
    quantity: float
    unit: str  # kg, m, sheets, etc.
    location: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    last_updated: datetime = Field(default_factory=datetime.now)


class WorkspaceActivity(BaseModel):
    """Workspace activity summary"""
    mode: WorkspaceMode
    safety_status: str
    activity_level: str
    active_equipment: List[str]
    active_projects: List[str]
    active_workflows: List[str]
    people_count: int = 0
    alerts: List[Dict[str, Any]] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.now)


class AssistantRequest(BaseModel):
    """AI assistant request"""
    query: str
    context: Optional[Dict[str, Any]] = None
    require_confirmation: bool = True


# Endpoints

@router.get("/status", response_model=WorkspaceActivity)
async def get_workspace_status():
    """Get current workspace status"""
    # Gather status from various sources
    active_equipment = []  # Would get from equipment service
    active_projects = list(workspace_state["active_projects"].keys())
    active_workflows = [
        wf_id for wf_id, wf in workspace_state["active_workflows"].items()
        if wf["status"] == WorkflowStatus.RUNNING
    ]
    
    # Check for any alerts
    alerts = []
    if workspace_state["safety_status"] != "safe":
        alerts.append({
            "type": "safety",
            "level": "warning",
            "message": "Safety concern detected"
        })
        
    return WorkspaceActivity(
        mode=workspace_state["mode"],
        safety_status=workspace_state["safety_status"],
        activity_level=workspace_state["activity_level"],
        active_equipment=active_equipment,
        active_projects=active_projects,
        active_workflows=active_workflows,
        people_count=1,  # Would get from vision system
        alerts=alerts
    )


@router.put("/config", response_model=Dict[str, str])
async def update_workspace_config(
    config: WorkspaceConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update workspace configuration"""
    logger.info(f"Workspace config update by {current_user['username']}: mode={config.mode}")
    
    workspace_state["mode"] = config.mode
    
    # Apply configuration changes
    # Would update various services based on mode
    
    return {
        "status": "success",
        "message": f"Workspace mode set to {config.mode}"
    }


# Project management
@router.post("/projects", response_model=Project)
async def create_project(
    project: Project,
    current_user: dict = Depends(get_current_user)
):
    """Create a new project"""
    if project.id in workspace_state["active_projects"]:
        raise HTTPException(status_code=400, detail="Project ID already exists")
        
    workspace_state["active_projects"][project.id] = project.dict()
    
    logger.info(f"Created project: {project.name} ({project.type})")
    
    return project


@router.get("/projects", response_model=List[Project])
async def get_projects(
    active_only: bool = True
):
    """Get all projects"""
    projects = []
    
    for project_data in workspace_state["active_projects"].values():
        if not active_only or project_data.get("status") == "active":
            projects.append(Project(**project_data))
            
    return projects


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get specific project"""
    if project_id not in workspace_state["active_projects"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return Project(**workspace_state["active_projects"][project_id])


@router.patch("/projects/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    updates: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update project"""
    if project_id not in workspace_state["active_projects"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    project_data = workspace_state["active_projects"][project_id]
    project_data.update(updates)
    
    return Project(**project_data)


@router.delete("/projects/{project_id}", response_model=Dict[str, str])
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete project"""
    if project_id not in workspace_state["active_projects"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    del workspace_state["active_projects"][project_id]
    
    return {
        "status": "success",
        "message": f"Project {project_id} deleted"
    }


# Workflow management
@router.post("/workflows", response_model=Workflow)
async def create_workflow(
    workflow: Workflow,
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow"""
    if workflow.id in workspace_state["active_workflows"]:
        raise HTTPException(status_code=400, detail="Workflow ID already exists")
        
    workspace_state["active_workflows"][workflow.id] = workflow.dict()
    
    logger.info(f"Created workflow: {workflow.name}")
    
    return workflow


@router.get("/workflows", response_model=List[Workflow])
async def get_workflows(
    status: Optional[WorkflowStatus] = None
):
    """Get all workflows"""
    workflows = []
    
    for workflow_data in workspace_state["active_workflows"].values():
        if not status or workflow_data.get("status") == status:
            workflows.append(Workflow(**workflow_data))
            
    return workflows


@router.post("/workflows/{workflow_id}/start", response_model=Dict[str, str])
async def start_workflow(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start a workflow"""
    if workflow_id not in workspace_state["active_workflows"]:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    workflow = workspace_state["active_workflows"][workflow_id]
    
    if workflow["status"] != WorkflowStatus.IDLE:
        raise HTTPException(status_code=400, detail="Workflow not idle")
        
    workflow["status"] = WorkflowStatus.RUNNING
    workflow["started_at"] = datetime.now().isoformat()
    
    async def execute_workflow():
        """Execute workflow steps"""
        try:
            for i, step in enumerate(workflow["steps"]):
                workflow["current_step"] = i
                
                # Execute step based on type
                await execute_workflow_step(workflow_id, step)
                
                # Check if workflow was paused or stopped
                if workflow["status"] != WorkflowStatus.RUNNING:
                    break
                    
            if workflow["status"] == WorkflowStatus.RUNNING:
                workflow["status"] = WorkflowStatus.COMPLETED
                workflow["completed_at"] = datetime.now().isoformat()
                
        except Exception as e:
            logger.error(f"Workflow error: {e}")
            workflow["status"] = WorkflowStatus.ERROR
            workflow["error"] = str(e)
            
    background_tasks.add_task(execute_workflow)
    
    return {
        "status": "success",
        "message": f"Workflow {workflow_id} started"
    }


@router.post("/workflows/{workflow_id}/pause", response_model=Dict[str, str])
async def pause_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause a running workflow"""
    if workflow_id not in workspace_state["active_workflows"]:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    workflow = workspace_state["active_workflows"][workflow_id]
    
    if workflow["status"] != WorkflowStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Workflow not running")
        
    workflow["status"] = WorkflowStatus.PAUSED
    
    return {
        "status": "success",
        "message": f"Workflow {workflow_id} paused"
    }


# Material management
material_inventory: Dict[str, MaterialInventory] = {}


@router.post("/materials", response_model=MaterialInventory)
async def add_material(
    material: MaterialInventory,
    current_user: dict = Depends(get_current_user)
):
    """Add material to inventory"""
    material_inventory[material.material_id] = material
    
    logger.info(f"Added material: {material.name} ({material.quantity} {material.unit})")
    
    return material


@router.get("/materials", response_model=List[MaterialInventory])
async def get_materials(
    material_type: Optional[str] = None
):
    """Get material inventory"""
    materials = []
    
    for material in material_inventory.values():
        if not material_type or material.type == material_type:
            materials.append(material)
            
    return materials


@router.patch("/materials/{material_id}/consume", response_model=MaterialInventory)
async def consume_material(
    material_id: str,
    quantity: float,
    current_user: dict = Depends(get_current_user)
):
    """Consume material from inventory"""
    if material_id not in material_inventory:
        raise HTTPException(status_code=404, detail="Material not found")
        
    material = material_inventory[material_id]
    
    if material.quantity < quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient material. Available: {material.quantity} {material.unit}"
        )
        
    material.quantity -= quantity
    material.last_updated = datetime.now()
    
    logger.info(f"Consumed {quantity} {material.unit} of {material.name}")
    
    return material


# AI Assistant integration
@router.post("/assistant/query", response_model=Dict[str, Any])
async def query_assistant(
    request: AssistantRequest,
    current_user: dict = Depends(get_current_user)
):
    """Query the AI assistant"""
    logger.info(f"Assistant query: {request.query}")
    
    # Parse query intent
    query_lower = request.query.lower()
    
    # Simple intent detection
    if "status" in query_lower:
        # Return workspace status
        status = await get_workspace_status()
        response = f"The workspace is in {status.mode} mode with {status.activity_level} activity level."
        
    elif "print" in query_lower:
        # Handle print requests
        response = "To start a 3D print, please specify the file and printer."
        
    elif "material" in query_lower:
        # Check materials
        materials = await get_materials()
        response = f"You have {len(materials)} materials in inventory."
        
    elif "help" in query_lower:
        # Provide help
        response = "I can help you with:\n- Checking workspace status\n- Starting print jobs\n- Managing materials\n- Creating workflows"
        
    else:
        response = "I'm not sure how to help with that. Try asking about status, printing, or materials."
        
    return {
        "query": request.query,
        "response": response,
        "require_confirmation": request.require_confirmation,
        "timestamp": datetime.now().isoformat()
    }


# Workspace automation
@router.post("/automation/recipe", response_model=Dict[str, str])
async def create_automation_recipe(
    name: str,
    trigger: Dict[str, Any],
    actions: List[Dict[str, Any]],
    current_user: dict = Depends(get_current_user)
):
    """Create an automation recipe"""
    recipe_id = f"recipe_{datetime.now().timestamp()}"
    
    # Store recipe (would save to database)
    recipe = {
        "id": recipe_id,
        "name": name,
        "trigger": trigger,
        "actions": actions,
        "created_by": current_user["username"],
        "created_at": datetime.now().isoformat()
    }
    
    logger.info(f"Created automation recipe: {name}")
    
    return {
        "status": "success",
        "recipe_id": recipe_id,
        "message": f"Automation recipe '{name}' created"
    }


# Safety monitoring
@router.get("/safety/status", response_model=Dict[str, Any])
async def get_safety_status():
    """Get detailed safety status"""
    return {
        "overall_status": workspace_state["safety_status"],
        "checks": {
            "emergency_stop": {"status": "ready", "tested": datetime.now().isoformat()},
            "fire_detection": {"status": "active", "sensors": 4},
            "ventilation": {"status": "good", "air_quality": 95},
            "equipment_guards": {"status": "secure", "verified": True},
            "ppe_compliance": {"status": "partial", "compliance_rate": 0.75}
        },
        "recent_incidents": [],
        "last_safety_check": datetime.now().isoformat()
    }


@router.post("/safety/emergency-stop", response_model=Dict[str, str])
async def trigger_emergency_stop(
    reason: str = "Manual trigger",
    current_user: dict = Depends(get_current_user)
):
    """Trigger emergency stop"""
    logger.critical(f"EMERGENCY STOP triggered by {current_user['username']}: {reason}")
    
    # Would trigger actual emergency stop on all equipment
    workspace_state["safety_status"] = "emergency_stop"
    
    # Notify all services
    # Stop all workflows
    for workflow in workspace_state["active_workflows"].values():
        if workflow["status"] == WorkflowStatus.RUNNING:
            workflow["status"] = WorkflowStatus.ERROR
            workflow["error"] = "Emergency stop"
            
    return {
        "status": "activated",
        "message": "Emergency stop activated",
        "timestamp": datetime.now().isoformat()
    }


@router.post("/safety/reset", response_model=Dict[str, str])
async def reset_safety_system(
    current_user: dict = Depends(get_current_user)
):
    """Reset safety system after emergency stop"""
    if workspace_state["safety_status"] != "emergency_stop":
        raise HTTPException(status_code=400, detail="No emergency stop to reset")
        
    logger.info(f"Safety system reset by {current_user['username']}")
    
    workspace_state["safety_status"] = "safe"
    
    return {
        "status": "success",
        "message": "Safety system reset"
    }


# Activity tracking
@router.get("/activity/timeline", response_model=List[Dict[str, Any]])
async def get_activity_timeline(
    hours: int = 24
):
    """Get activity timeline"""
    # Would retrieve from database
    timeline = [
        {
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "type": "project_started",
            "description": "Started project: Desk Organizer",
            "user": "john"
        },
        {
            "timestamp": (datetime.now() - timedelta(hours=1)).isoformat(),
            "type": "print_completed",
            "description": "3D print completed: bracket.stl",
            "duration_minutes": 45
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=30)).isoformat(),
            "type": "material_consumed",
            "description": "Used 125g of PLA filament",
            "material": "PLA Black"
        }
    ]
    
    return timeline


@router.get("/suggestions", response_model=List[Dict[str, Any]])
async def get_workspace_suggestions():
    """Get AI-powered workspace suggestions"""
    suggestions = []
    
    # Check material levels
    for material in material_inventory.values():
        if material.quantity < 100:  # Low threshold
            suggestions.append({
                "type": "material_low",
                "priority": "medium",
                "title": f"Low {material.name} stock",
                "description": f"Only {material.quantity} {material.unit} remaining",
                "action": f"Order more {material.name}"
            })
            
    # Check equipment maintenance
    suggestions.append({
        "type": "maintenance",
        "priority": "low",
        "title": "3D printer maintenance due",
        "description": "Nozzle cleaning recommended after 50 hours of printing",
        "action": "Schedule maintenance"
    })
    
    # Workflow optimization
    if len(workspace_state["active_workflows"]) > 0:
        suggestions.append({
            "type": "optimization",
            "priority": "low",
            "title": "Workflow optimization available",
            "description": "Parallel processing could reduce time by 30%",
            "action": "Review workflow"
        })
        
    return suggestions


# Helper functions
async def execute_workflow_step(workflow_id: str, step: Dict[str, Any]):
    """Execute a single workflow step"""
    step_type = step.get("type")
    
    logger.info(f"Executing workflow step: {step_type}")
    
    if step_type == "wait":
        await asyncio.sleep(step.get("duration", 1))
        
    elif step_type == "print":
        # Would trigger actual print
        await asyncio.sleep(2)
        
    elif step_type == "move":
        # Would trigger equipment movement
        await asyncio.sleep(1)
        
    elif step_type == "check":
        # Would perform checks
        await asyncio.sleep(0.5)
        
    else:
        logger.warning(f"Unknown step type: {step_type}")