# software/backend/core/machine_types.py
"""
W.I.T. Machine Type Definitions
Central configuration for all supported machine types

Inspired by OctoEverywhere's universal printer control architecture
(https://github.com/QuinnDamerell/OctoPrint-OctoEverywhere)
"""
from enum import Enum
from typing import Dict, List, Any, Optional

class MachineCategory(str, Enum):
    """Main categories of workshop machines"""
    ADDITIVE = "additive"           # 3D printers (FDM, SLA, SLS)
    SUBTRACTIVE = "subtractive"     # CNC mills, lathes, routers
    LASER = "laser"                 # Laser cutters, engravers
    SPECIALTY = "specialty"         # Pick & place, vinyl cutters, etc.
    ROBOTIC = "robotic"            # Robot arms, automation
    INSPECTION = "inspection"       # CMM, optical inspection
    POST_PROCESSING = "post_processing"  # Wash/cure, annealing, etc.

class MachineType(str, Enum):
    """Specific machine types"""
    # 3D Printers - FDM
    PRINTER_3D_FDM = "3d_printer_fdm"
    PRINTER_3D_COREXY = "3d_printer_corexy"
    PRINTER_3D_DELTA = "3d_printer_delta"
    PRINTER_3D_IDEX = "3d_printer_idex"
    
    # 3D Printers - Resin
    PRINTER_3D_SLA = "3d_printer_sla"
    PRINTER_3D_DLP = "3d_printer_dlp"
    PRINTER_3D_LCD = "3d_printer_lcd"
    
    # 3D Printers - Industrial
    PRINTER_3D_SLS = "3d_printer_sls"
    PRINTER_3D_MJF = "3d_printer_mjf"
    PRINTER_3D_METAL = "3d_printer_metal"
    
    # CNC Machines
    CNC_MILL_3AXIS = "cnc_mill_3axis"
    CNC_MILL_5AXIS = "cnc_mill_5axis"
    CNC_LATHE = "cnc_lathe"
    CNC_ROUTER = "cnc_router"
    CNC_PLASMA = "cnc_plasma"
    CNC_WATERJET = "cnc_waterjet"
    
    # Laser Machines
    LASER_CO2 = "laser_co2"
    LASER_FIBER = "laser_fiber"
    LASER_DIODE = "laser_diode"
    
    # Specialty
    PICK_PLACE = "pick_and_place"
    VINYL_CUTTER = "vinyl_cutter"
    PCB_MILL = "pcb_mill"
    EMBROIDERY = "embroidery_machine"
    
    # Robotic
    ROBOT_ARM_6DOF = "robot_arm_6dof"
    ROBOT_ARM_SCARA = "robot_arm_scara"
    ROBOT_ARM_COBOT = "robot_arm_cobot"
    
    # Inspection
    CMM_TOUCH = "cmm_touch_probe"
    CMM_OPTICAL = "cmm_optical"
    MICROSCOPE_DIGITAL = "microscope_digital"
    
    # Post Processing
    WASH_CURE_STATION = "wash_cure_station"
    VACUUM_FORMER = "vacuum_former"
    ANNEALING_OVEN = "annealing_oven"

class ConnectionProtocol(str, Enum):
    """Communication protocols for machines"""
    # Serial protocols
    SERIAL_GCODE = "serial_gcode"       # Standard RepRap/Marlin
    SERIAL_GRBL = "serial_grbl"         # CNC standard
    SERIAL_CUSTOM = "serial_custom"     # Proprietary serial
    
    # Network protocols
    HTTP_REST = "http_rest"             # REST API (OctoPrint)
    WEBSOCKET = "websocket"             # Real-time (Moonraker)
    MQTT = "mqtt"                       # Message queue (Bambu)
    JSON_RPC = "json_rpc"              # RPC over WebSocket
    TCP_RAW = "tcp_raw"                # Raw TCP socket
    MODBUS_TCP = "modbus_tcp"          # Industrial protocol
    
    # Specialized
    OCTOPRINT = "octoprint"            # OctoPrint API
    MOONRAKER = "moonraker"            # Klipper/Moonraker
    PRUSALINK = "prusalink"            # Prusa's protocol
    BAMBU_MQTT = "bambu_mqtt"          # Bambu's MQTT
    DUET_RRF = "duet_rrf"              # Duet RepRapFirmware
    ELEGOO_WS = "elegoo_ws"            # Elegoo WebSocket

class MachineCapability(str, Enum):
    """Standard machine capabilities"""
    # Basic operations
    START = "start"
    PAUSE = "pause"
    RESUME = "resume"
    STOP = "stop"
    CANCEL = "cancel"
    
    # Temperature control
    TEMP_HOTEND = "temp_hotend"
    TEMP_BED = "temp_bed"
    TEMP_CHAMBER = "temp_chamber"
    TEMP_CONTROL = "temp_control"
    
    # Motion control
    HOME = "home"
    JOG = "jog"
    PROBE = "probe"
    LEVEL = "level"
    
    # File operations
    UPLOAD = "upload"
    DELETE = "delete"
    LIST_FILES = "list_files"
    
    # Monitoring
    CAMERA = "camera"
    TIMELAPSE = "timelapse"
    PROGRESS = "progress"
    SENSORS = "sensors"
    
    # Advanced
    MULTI_MATERIAL = "multi_material"
    TOOL_CHANGE = "tool_change"
    FILAMENT_DETECT = "filament_detect"
    POWER_RECOVERY = "power_recovery"
    MESH_LEVELING = "mesh_leveling"
    
    # Safety
    EMERGENCY_STOP = "emergency_stop"
    DOOR_LOCK = "door_lock"
    FUME_EXTRACTION = "fume_extraction"

class PrinterState(str, Enum):
    """Universal printer states (normalized across all platforms)"""
    UNKNOWN = "unknown"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    IDLE = "idle"
    BUSY = "busy"
    PREPARING = "preparing"      # Loading, homing, heating
    PRINTING = "printing"
    PAUSING = "pausing"
    PAUSED = "paused"
    RESUMING = "resuming"
    COMPLETING = "completing"
    COMPLETE = "complete"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"
    ERROR = "error"
    MAINTENANCE = "maintenance"

# Machine type configurations
MACHINE_CONFIGS: Dict[str, Dict[str, Any]] = {
    # FDM 3D Printers
    MachineType.PRINTER_3D_FDM: {
        "category": MachineCategory.ADDITIVE,
        "name": "FDM 3D Printer",
        "description": "Fused Deposition Modeling printer",
        "connection_protocols": [
            ConnectionProtocol.SERIAL_GCODE,
            ConnectionProtocol.OCTOPRINT,
            ConnectionProtocol.MOONRAKER,
            ConnectionProtocol.PRUSALINK,
            ConnectionProtocol.HTTP_REST,
        ],
        "capabilities": [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.RESUME,
            MachineCapability.CANCEL,
            MachineCapability.TEMP_HOTEND,
            MachineCapability.TEMP_BED,
            MachineCapability.HOME,
            MachineCapability.JOG,
            MachineCapability.LEVEL,
            MachineCapability.UPLOAD,
            MachineCapability.PROGRESS,
            MachineCapability.FILAMENT_DETECT,
        ],
        "required_sensors": ["hotend_temp", "bed_temp"],
        "optional_sensors": ["chamber_temp", "filament", "power"],
        "file_formats": [".gcode", ".g", ".gco"],
        "state_mapping": {
            # OctoPrint states
            "PRINTING": PrinterState.PRINTING,
            "PAUSED": PrinterState.PAUSED,
            "OPERATIONAL": PrinterState.IDLE,
            # Moonraker states
            "printing": PrinterState.PRINTING,
            "paused": PrinterState.PAUSED,
            "standby": PrinterState.IDLE,
            # Marlin states
            "SD_PRINTING": PrinterState.PRINTING,
            "CANCELLED": PrinterState.CANCELLED,
        }
    },
    
    # CoreXY 3D Printer (often faster, more advanced)
    MachineType.PRINTER_3D_COREXY: {
        "category": MachineCategory.ADDITIVE,
        "name": "CoreXY 3D Printer",
        "description": "High-speed CoreXY motion system printer",
        "connection_protocols": [
            ConnectionProtocol.MOONRAKER,
            ConnectionProtocol.DUET_RRF,
            ConnectionProtocol.SERIAL_GCODE,
            ConnectionProtocol.BAMBU_MQTT,
        ],
        "capabilities": [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.RESUME,
            MachineCapability.CANCEL,
            MachineCapability.TEMP_HOTEND,
            MachineCapability.TEMP_BED,
            MachineCapability.TEMP_CHAMBER,
            MachineCapability.HOME,
            MachineCapability.JOG,
            MachineCapability.PROBE,
            MachineCapability.MESH_LEVELING,
            MachineCapability.UPLOAD,
            MachineCapability.PROGRESS,
            MachineCapability.CAMERA,
            MachineCapability.FILAMENT_DETECT,
            MachineCapability.TOOL_CHANGE,
        ],
        "required_sensors": ["hotend_temp", "bed_temp", "mcu_temp"],
        "optional_sensors": ["chamber_temp", "filament", "accelerometer", "pressure_advance"],
        "file_formats": [".gcode", ".g", ".bgcode", ".3mf"],
        "state_mapping": {
            # Klipper/Moonraker states
            "printing": PrinterState.PRINTING,
            "paused": PrinterState.PAUSED,
            "complete": PrinterState.COMPLETE,
            "cancelled": PrinterState.CANCELLED,
            "ready": PrinterState.IDLE,
            # Bambu states
            "RUNNING": PrinterState.PRINTING,
            "PAUSE": PrinterState.PAUSED,
            "FINISH": PrinterState.COMPLETE,
            "IDLE": PrinterState.IDLE,
            "PREPARE": PrinterState.PREPARING,
            "SLICING": PrinterState.PREPARING,
        }
    },
    
    # SLA/Resin Printer
    MachineType.PRINTER_3D_SLA: {
        "category": MachineCategory.ADDITIVE,
        "name": "SLA 3D Printer",
        "description": "Stereolithography resin printer",
        "connection_protocols": [
            ConnectionProtocol.HTTP_REST,
            ConnectionProtocol.WEBSOCKET,
            ConnectionProtocol.ELEGOO_WS,
            ConnectionProtocol.TCP_RAW,
        ],
        "capabilities": [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.RESUME,
            MachineCapability.CANCEL,
            MachineCapability.TEMP_CHAMBER,
            MachineCapability.HOME,
            MachineCapability.UPLOAD,
            MachineCapability.PROGRESS,
            MachineCapability.DOOR_LOCK,
        ],
        "required_sensors": ["uv_power", "resin_level"],
        "optional_sensors": ["chamber_temp", "vat_temp"],
        "file_formats": [".ctb", ".cbddlp", ".photon", ".pwmo", ".sl1"],
        "state_mapping": {
            # Elegoo states (numeric)
            "0": PrinterState.IDLE,
            "1": PrinterState.PREPARING,
            "13": PrinterState.PRINTING,
            "5": PrinterState.PAUSING,
            "6": PrinterState.PAUSED,
            "8": PrinterState.CANCELLED,
            "9": PrinterState.COMPLETE,
            "14": PrinterState.CANCELLED,
        }
    },
    
    # CNC Mill
    MachineType.CNC_MILL_3AXIS: {
        "category": MachineCategory.SUBTRACTIVE,
        "name": "3-Axis CNC Mill",
        "description": "3-axis milling machine",
        "connection_protocols": [
            ConnectionProtocol.SERIAL_GRBL,
            ConnectionProtocol.MODBUS_TCP,
            ConnectionProtocol.TCP_RAW,
        ],
        "capabilities": [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.RESUME,
            MachineCapability.STOP,
            MachineCapability.HOME,
            MachineCapability.JOG,
            MachineCapability.PROBE,
            MachineCapability.UPLOAD,
            MachineCapability.PROGRESS,
            MachineCapability.EMERGENCY_STOP,
        ],
        "required_sensors": ["spindle_speed", "axis_position"],
        "optional_sensors": ["spindle_load", "coolant_flow", "tool_length"],
        "file_formats": [".nc", ".tap", ".gcode", ".ngc"],
        "state_mapping": {
            # GRBL states
            "Idle": PrinterState.IDLE,
            "Run": PrinterState.PRINTING,
            "Hold": PrinterState.PAUSED,
            "Door": PrinterState.PAUSED,
            "Home": PrinterState.PREPARING,
            "Alarm": PrinterState.ERROR,
        }
    },
    
    # Laser Cutter
    MachineType.LASER_CO2: {
        "category": MachineCategory.LASER,
        "name": "CO2 Laser Cutter",
        "description": "CO2 laser cutting/engraving machine",
        "connection_protocols": [
            ConnectionProtocol.SERIAL_GCODE,
            ConnectionProtocol.SERIAL_GRBL,
            ConnectionProtocol.HTTP_REST,
        ],
        "capabilities": [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.RESUME,
            MachineCapability.STOP,
            MachineCapability.HOME,
            MachineCapability.JOG,
            MachineCapability.UPLOAD,
            MachineCapability.PROGRESS,
            MachineCapability.EMERGENCY_STOP,
            MachineCapability.DOOR_LOCK,
            MachineCapability.FUME_EXTRACTION,
        ],
        "required_sensors": ["laser_power", "door_status", "fume_extraction"],
        "optional_sensors": ["material_height", "assist_gas_pressure", "cooling_temp"],
        "file_formats": [".svg", ".dxf", ".pdf", ".gcode", ".rd"],
        "state_mapping": {
            "Idle": PrinterState.IDLE,
            "Running": PrinterState.PRINTING,
            "Paused": PrinterState.PAUSED,
            "Complete": PrinterState.COMPLETE,
            "Error": PrinterState.ERROR,
        }
    },
}

# Helper functions
def get_machine_config(machine_type: MachineType) -> Optional[Dict[str, Any]]:
    """Get configuration for a specific machine type"""
    return MACHINE_CONFIGS.get(machine_type)

def get_machines_by_category(category: MachineCategory) -> List[MachineType]:
    """Get all machine types in a category"""
    machines = []
    for machine_type, config in MACHINE_CONFIGS.items():
        if config.get("category") == category:
            machines.append(machine_type)
    return machines

def get_supported_protocols(machine_type: MachineType) -> List[ConnectionProtocol]:
    """Get supported connection protocols for a machine type"""
    config = get_machine_config(machine_type)
    if config:
        return config.get("connection_protocols", [])
    return []

def normalize_state(machine_type: MachineType, platform_state: str) -> PrinterState:
    """Normalize a platform-specific state to universal state"""
    config = get_machine_config(machine_type)
    if config:
        state_mapping = config.get("state_mapping", {})
        return state_mapping.get(platform_state, PrinterState.UNKNOWN)
    return PrinterState.UNKNOWN