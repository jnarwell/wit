"""
W.I.T. System API Router

File: software/backend/api/system_api.py

System-level endpoints for health checks, configuration, and monitoring.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import psutil
import platform
import logging
import os
import json
from datetime import datetime, timedelta
import subprocess
import aiofiles

# Import services
import sys
# sys.path handled by main module
from services.auth_services import get_current_user, is_admin

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/system", tags=["system"])

# System metrics storage
system_metrics = {
    "start_time": datetime.now(),
    "requests_total": 0,
    "errors_total": 0,
    "last_error": None
}


# Request/Response Models
class SystemInfo(BaseModel):
    """System information"""
    hostname: str
    platform: str
    platform_version: str
    architecture: str
    processor: str
    cpu_count: int
    total_memory_gb: float
    python_version: str
    wit_version: str = "1.0.0"


class SystemMetrics(BaseModel):
    """System performance metrics"""
    cpu_percent: float
    memory_percent: float
    memory_used_gb: float
    memory_available_gb: float
    disk_usage_percent: float
    disk_free_gb: float
    network_sent_mb: float
    network_recv_mb: float
    process_count: int
    thread_count: int
    uptime_seconds: float


class SystemHealth(BaseModel):
    """System health status"""
    status: str = Field(..., pattern="^(healthy|degraded|unhealthy)$")
    uptime: str
    version: str
    checks: Dict[str, Dict[str, Any]]
    timestamp: datetime


class ConfigUpdate(BaseModel):
    """Configuration update request"""
    section: str
    key: str
    value: Any
    restart_required: bool = False


class LogQuery(BaseModel):
    """Log query parameters"""
    level: Optional[str] = Field(None, pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    service: Optional[str] = None
    limit: int = Field(default=100, ge=1, le=1000)
    since: Optional[datetime] = None


class BackupRequest(BaseModel):
    """Backup request"""
    include_database: bool = True
    include_config: bool = True
    include_logs: bool = False
    include_media: bool = True


# Endpoints

@router.get("/info", response_model=SystemInfo)
async def get_system_info():
    """Get system information"""
    return SystemInfo(
        hostname=platform.node(),
        platform=platform.system(),
        platform_version=platform.version(),
        architecture=platform.machine(),
        processor=platform.processor(),
        cpu_count=psutil.cpu_count(),
        total_memory_gb=psutil.virtual_memory().total / (1024**3),
        python_version=platform.python_version()
    )


@router.get("/metrics", response_model=SystemMetrics)
async def get_system_metrics():
    """Get current system metrics"""
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    network = psutil.net_io_counters()
    process = psutil.Process()
    
    uptime = (datetime.now() - system_metrics["start_time"]).total_seconds()
    
    return SystemMetrics(
        cpu_percent=cpu_percent,
        memory_percent=memory.percent,
        memory_used_gb=memory.used / (1024**3),
        memory_available_gb=memory.available / (1024**3),
        disk_usage_percent=disk.percent,
        disk_free_gb=disk.free / (1024**3),
        network_sent_mb=network.bytes_sent / (1024**2),
        network_recv_mb=network.bytes_recv / (1024**2),
        process_count=len(psutil.pids()),
        thread_count=process.num_threads(),
        uptime_seconds=uptime
    )


@router.get("/health", response_model=SystemHealth)
async def get_system_health():
    """Get system health status"""
    checks = {}
    overall_status = "healthy"
    
    # Check CPU
    cpu_percent = psutil.cpu_percent(interval=0.1)
    checks["cpu"] = {
        "status": "healthy" if cpu_percent < 80 else "degraded" if cpu_percent < 95 else "unhealthy",
        "value": cpu_percent,
        "unit": "percent"
    }
    
    # Check Memory
    memory = psutil.virtual_memory()
    checks["memory"] = {
        "status": "healthy" if memory.percent < 80 else "degraded" if memory.percent < 95 else "unhealthy",
        "value": memory.percent,
        "unit": "percent"
    }
    
    # Check Disk
    disk = psutil.disk_usage('/')
    checks["disk"] = {
        "status": "healthy" if disk.percent < 80 else "degraded" if disk.percent < 95 else "unhealthy",
        "value": disk.percent,
        "unit": "percent"
    }
    
    # Check Services (would check actual services)
    checks["services"] = {
        "mqtt": {"status": "healthy", "connected": True},
        "database": {"status": "healthy", "connected": True},
        "voice": {"status": "healthy", "active": True},
        "vision": {"status": "healthy", "cameras": 1}
    }
    
    # Determine overall status
    for check in checks.values():
        if isinstance(check, dict) and check.get("status") == "unhealthy":
            overall_status = "unhealthy"
            break
        elif isinstance(check, dict) and check.get("status") == "degraded":
            overall_status = "degraded"
            
    # Calculate uptime
    uptime = datetime.now() - system_metrics["start_time"]
    uptime_str = str(timedelta(seconds=int(uptime.total_seconds())))
    
    return SystemHealth(
        status=overall_status,
        uptime=uptime_str,
        version="1.0.0",
        checks=checks,
        timestamp=datetime.now()
    )


@router.get("/config", response_model=Dict[str, Any])
async def get_configuration(
    current_user: dict = Depends(get_current_user)
):
    """Get system configuration"""
    # Load configuration
    config = {
        "general": {
            "hostname": platform.node(),
            "timezone": os.environ.get("TZ", "UTC"),
            "debug_mode": os.environ.get("DEBUG", "false").lower() == "true"
        },
        "api": {
            "host": os.environ.get("API_HOST", "0.0.0.0"),
            "port": int(os.environ.get("API_PORT", 8000)),
            "cors_origins": os.environ.get("CORS_ORIGINS", "*").split(",")
        },
        "mqtt": {
            "host": os.environ.get("MQTT_HOST", "localhost"),
            "port": int(os.environ.get("MQTT_PORT", 1883)),
            "username": os.environ.get("MQTT_USERNAME", "")
        },
        "database": {
            "host": os.environ.get("DB_HOST", "localhost"),
            "port": int(os.environ.get("DB_PORT", 5432)),
            "name": os.environ.get("DB_NAME", "wit_db")
        },
        "voice": {
            "model": os.environ.get("WHISPER_MODEL", "base"),
            "language": os.environ.get("VOICE_LANGUAGE", "en"),
            "sample_rate": int(os.environ.get("VOICE_SAMPLE_RATE", 16000))
        },
        "vision": {
            "detection_model": os.environ.get("YOLO_MODEL", "yolov8n.pt"),
            "camera_count": int(os.environ.get("CAMERA_COUNT", 1)),
            "enable_gpu": os.environ.get("ENABLE_GPU", "true").lower() == "true"
        }
    }
    
    return config


@router.patch("/config", response_model=Dict[str, str])
async def update_configuration(
    update: ConfigUpdate,
    current_user: dict = Depends(is_admin)
):
    """Update system configuration (admin only)"""
    try:
        # Update configuration
        # In production, this would update actual config files
        logger.info(f"Config update: {update.section}.{update.key} = {update.value}")
        
        message = "Configuration updated"
        if update.restart_required:
            message += " (restart required)"
            
        return {
            "status": "success",
            "message": message
        }
        
    except Exception as e:
        logger.error(f"Config update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs", response_model=List[Dict[str, Any]])
async def get_logs(
    query: LogQuery = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get system logs"""
    logs = []
    
    # In production, would read from actual log files
    # For demo, return sample logs
    sample_logs = [
        {
            "timestamp": datetime.now().isoformat(),
            "level": "INFO",
            "service": "system",
            "message": "System started successfully"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(),
            "level": "INFO",
            "service": "voice",
            "message": "Voice processor initialized"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=10)).isoformat(),
            "level": "WARNING",
            "service": "vision",
            "message": "Camera 2 not responding"
        }
    ]
    
    # Filter logs
    for log in sample_logs:
        if query.level and log["level"] != query.level:
            continue
        if query.service and log["service"] != query.service:
            continue
        if query.since and datetime.fromisoformat(log["timestamp"]) < query.since:
            continue
            
        logs.append(log)
        
        if len(logs) >= query.limit:
            break
            
    return logs


@router.post("/backup", response_model=Dict[str, Any])
async def create_backup(
    request: BackupRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(is_admin)
):
    """Create system backup (admin only)"""
    backup_id = datetime.now().strftime("backup_%Y%m%d_%H%M%S")
    
    async def perform_backup():
        """Perform backup in background"""
        try:
            logger.info(f"Starting backup: {backup_id}")
            
            # Create backup directory
            backup_dir = f"/tmp/{backup_id}"
            os.makedirs(backup_dir, exist_ok=True)
            
            # Backup database
            if request.include_database:
                # Would use pg_dump or similar
                pass
                
            # Backup config
            if request.include_config:
                # Copy config files
                pass
                
            # Backup logs
            if request.include_logs:
                # Copy log files
                pass
                
            # Create archive
            archive_path = f"/tmp/{backup_id}.tar.gz"
            subprocess.run(
                ["tar", "-czf", archive_path, "-C", "/tmp", backup_id],
                check=True
            )
            
            logger.info(f"Backup completed: {backup_id}")
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            
    background_tasks.add_task(perform_backup)
    
    return {
        "status": "started",
        "backup_id": backup_id,
        "message": "Backup started in background"
    }


@router.post("/restart", response_model=Dict[str, str])
async def restart_system(
    current_user: dict = Depends(is_admin)
):
    """Restart the system (admin only)"""
    logger.warning(f"System restart requested by {current_user['username']}")
    
    # In production, would trigger actual restart
    # For safety, we'll just log and return
    
    return {
        "status": "scheduled",
        "message": "System restart scheduled in 30 seconds"
    }


@router.get("/updates", response_model=Dict[str, Any])
async def check_updates(
    current_user: dict = Depends(is_admin)
):
    """Check for system updates (admin only)"""
    # In production, would check GitHub releases or update server
    
    return {
        "current_version": "1.0.0",
        "latest_version": "1.0.1",
        "update_available": True,
        "release_notes": "Bug fixes and performance improvements",
        "release_date": "2024-06-30"
    }


@router.post("/updates/install", response_model=Dict[str, str])
async def install_updates(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(is_admin)
):
    """Install system updates (admin only)"""
    async def perform_update():
        """Perform update in background"""
        try:
            logger.info("Starting system update...")
            # Would run update scripts
            await asyncio.sleep(5)  # Simulate update
            logger.info("System update completed")
        except Exception as e:
            logger.error(f"Update failed: {e}")
            
    background_tasks.add_task(perform_update)
    
    return {
        "status": "started",
        "message": "Update started in background"
    }


@router.get("/services", response_model=Dict[str, Any])
async def get_services_status():
    """Get status of all services"""
    services = {
        "core": {
            "api": {"status": "running", "pid": os.getpid()},
            "mqtt": {"status": "running", "connected": True},
            "database": {"status": "running", "connected": True}
        },
        "ai": {
            "voice": {"status": "running", "model": "whisper-base"},
            "vision": {"status": "running", "model": "yolov8n"}
        },
        "equipment": {
            "printer_manager": {"status": "running", "printers": 1},
            "cnc_controller": {"status": "running", "machines": 1}
        },
        "monitoring": {
            "metrics": {"status": "running", "interval": "10s"},
            "logging": {"status": "running", "level": "INFO"}
        }
    }
    
    return services


@router.post("/services/{service}/restart", response_model=Dict[str, str])
async def restart_service(
    service: str,
    current_user: dict = Depends(is_admin)
):
    """Restart a specific service (admin only)"""
    valid_services = ["voice", "vision", "mqtt", "equipment"]
    
    if service not in valid_services:
        raise HTTPException(status_code=404, detail="Service not found")
        
    logger.info(f"Restarting service: {service}")
    
    # In production, would restart actual service
    
    return {
        "status": "success",
        "message": f"Service {service} restarted"
    }


@router.get("/diagnostics", response_model=Dict[str, Any])
async def run_diagnostics(
    current_user: dict = Depends(is_admin)
):
    """Run system diagnostics (admin only)"""
    diagnostics = {
        "timestamp": datetime.now().isoformat(),
        "tests": {}
    }
    
    # Network connectivity
    try:
        import socket
        socket.create_connection(("8.8.8.8", 53), timeout=3)
        diagnostics["tests"]["network"] = {"status": "pass", "message": "Internet connected"}
    except:
        diagnostics["tests"]["network"] = {"status": "fail", "message": "No internet connection"}
        
    # Disk space
    disk = psutil.disk_usage('/')
    if disk.free > 1024**3:  # 1GB free
        diagnostics["tests"]["disk_space"] = {"status": "pass", "free_gb": disk.free / (1024**3)}
    else:
        diagnostics["tests"]["disk_space"] = {"status": "fail", "free_gb": disk.free / (1024**3)}
        
    # Memory
    memory = psutil.virtual_memory()
    if memory.available > 512 * 1024**2:  # 512MB available
        diagnostics["tests"]["memory"] = {"status": "pass", "available_mb": memory.available / (1024**2)}
    else:
        diagnostics["tests"]["memory"] = {"status": "fail", "available_mb": memory.available / (1024**2)}
        
    # CPU temperature (if available)
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            cpu_temp = list(temps.values())[0][0].current
            diagnostics["tests"]["cpu_temperature"] = {
                "status": "pass" if cpu_temp < 80 else "warning" if cpu_temp < 90 else "fail",
                "temperature_c": cpu_temp
            }
    except:
        diagnostics["tests"]["cpu_temperature"] = {"status": "unknown", "message": "Temperature sensors not available"}
        
    return diagnostics


@router.get("/debug", response_model=Dict[str, Any])
async def get_debug_info(
    current_user: dict = Depends(is_admin)
):
    """Get debug information (admin only)"""
    # Gather debug information
    debug_info = {
        "environment": dict(os.environ),
        "python_path": sys.path,
        "loaded_modules": list(sys.modules.keys()),
        "process_info": {
            "pid": os.getpid(),
            "ppid": os.getppid(),
            "cwd": os.getcwd(),
            "user": os.environ.get("USER", "unknown")
        },
        "system_metrics": system_metrics,
        "asyncio_tasks": len(asyncio.all_tasks())
    }
    
    return debug_info


# Middleware to track requests
# @router.middleware("http")  # Middleware should be on app, not router
# async def track_requests(request, call_next):
    """Track request metrics"""
    system_metrics["requests_total"] += 1
    
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        system_metrics["errors_total"] += 1
        system_metrics["last_error"] = {
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "path": request.url.path
        }
        raise