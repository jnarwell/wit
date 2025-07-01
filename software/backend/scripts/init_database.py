#!/usr/bin/env python3
"""
Initialize W.I.T. Database

Run this script to set up the database with initial data
"""
import asyncio
import sys
from pathlib import Path
import uuid

# Add parent to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from software.backend.services.database_services import DatabaseService
from software.backend.models.database_models import User, Equipment, Material, Workspace
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_initial_data(db_service):
    """Create initial data for development"""
    print("Creating initial data...")
    
    # Create default user
    default_user = User(
        username="admin",
        email="admin@wit.local",
        hashed_password=pwd_context.hash("admin123"),
        is_admin=True,
        preferences={
            "theme": "dark",
            "voice_enabled": True,
            "safety_alerts": True
        }
    )
    await db_service.create(default_user)
    print("✓ Created default admin user")
    
    # Create default workspace
    workspace = Workspace(
        name="Main Workshop",
        description="Primary maker space",
        layout={
            "dimensions": {"x": 10, "y": 8, "z": 3},
            "units": "meters"
        },
        zones=[
            {"name": "3D Printing", "bounds": {"x": [0, 3], "y": [0, 4]}},
            {"name": "CNC Area", "bounds": {"x": [3, 6], "y": [0, 4]}},
            {"name": "Assembly", "bounds": {"x": [6, 10], "y": [0, 8]}}
        ]
    )
    await db_service.create(workspace)
    print("✓ Created default workspace")
    
    # Create sample equipment
    equipment_list = [
        {
            "equipment_id": "3dp-001",
            "name": "Prusa i3 MK3S+",
            "type": "3d_printer",
            "manufacturer": "Prusa Research",
            "model": "i3 MK3S+",
            "connection_type": "serial",
            "workspace_id": workspace.id,
            "capabilities": {
                "build_volume": {"x": 250, "y": 210, "z": 210},
                "materials": ["PLA", "PETG", "ABS", "TPU"],
                "features": ["auto_bed_leveling", "filament_sensor", "power_recovery"]
            }
        },
        {
            "equipment_id": "cnc-001",
            "name": "Shapeoko 4",
            "type": "cnc_router",
            "manufacturer": "Carbide 3D",
            "model": "Shapeoko 4 XL",
            "connection_type": "grbl",
            "workspace_id": workspace.id,
            "capabilities": {
                "work_area": {"x": 838, "y": 838, "z": 95},
                "spindle": "Makita RT0701C",
                "materials": ["wood", "plastic", "aluminum"]
            }
        }
    ]
    
    for eq_data in equipment_list:
        equipment = Equipment(**eq_data)
        await db_service.create(equipment)
    print(f"✓ Created {len(equipment_list)} equipment items")
    
    # Create sample materials
    materials = [
        {
            "material_id": "fil-pla-001",
            "name": "PLA Filament - Black",
            "type": "filament",
            "subtype": "PLA",
            "quantity": 2.5,
            "unit": "kg",
            "color": "black",
            "properties": {
                "diameter": 1.75,
                "temperature": {"nozzle": 215, "bed": 60}
            }
        },
        {
            "material_id": "wood-pine-001",
            "name": "Pine Board",
            "type": "wood",
            "subtype": "pine",
            "quantity": 10,
            "unit": "boards",
            "properties": {
                "dimensions": {"length": 2440, "width": 100, "thickness": 25}
            }
        }
    ]
    
    for mat_data in materials:
        material = Material(**mat_data)
        await db_service.create(material)
    print(f"✓ Created {len(materials)} material items")
    
    print("\n✨ Database initialized successfully!")

async def main():
    """Main initialization function"""
    print("W.I.T. Database Initialization")
    print("=" * 40)
    
    # Create database service
    db_service = DatabaseService()
    
    # Connect to database
    await db_service.connect()
    
    # Create tables
    print("Creating database tables...")
    await db_service.create_tables()
    print("✓ Tables created")
    
    # Create initial data
    await create_initial_data(db_service)
    
    # Disconnect
    await db_service.disconnect()
    
    print("\n🚀 Database ready for use!")
    print("\nDefault credentials:")
    print("  Username: admin")
    print("  Password: admin123")

if __name__ == "__main__":
    asyncio.run(main())
