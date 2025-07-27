"""
Add sample tasks with due dates for testing
"""
import asyncio
from datetime import datetime, timedelta
import uuid
from sqlalchemy import text
from software.backend.services.database_services import get_session

async def add_sample_tasks():
    """Add sample tasks with due dates"""
    async for db in get_session():
        try:
            # First, get a project ID to associate tasks with
            result = await db.execute(text("SELECT id, project_id, name FROM projects LIMIT 1"))
            project = result.fetchone()
            
            if not project:
                print("❌ No projects found. Please create a project first.")
                return
                
            project_uuid, project_id, project_name = project
            print(f"✅ Using project: {project_name} ({project_id})")
            
            # Sample tasks with different due dates
            tasks = [
                {
                    "name": "Complete PCB Design Review",
                    "description": "Review and finalize the PCB layout for the new sensor module",
                    "status": "in_progress",
                    "priority": "high",
                    "due_date": datetime.now() + timedelta(days=1)
                },
                {
                    "name": "Update Firmware Documentation",
                    "description": "Document the new API endpoints and update the firmware changelog",
                    "status": "not_started",
                    "priority": "medium",
                    "due_date": datetime.now() + timedelta(days=3)
                },
                {
                    "name": "Fix Temperature Sensor Calibration",
                    "description": "Debug and fix the calibration drift issue in the temperature sensor readings",
                    "status": "in_progress",
                    "priority": "high",
                    "due_date": datetime.now() - timedelta(days=1)  # Overdue
                },
                {
                    "name": "Order Components for Prototype",
                    "description": "Place order for resistors, capacitors, and microcontrollers for the next prototype build",
                    "status": "not_started",
                    "priority": "high",
                    "due_date": datetime.now()  # Due today
                },
                {
                    "name": "Test Bluetooth Module Integration",
                    "description": "Run integration tests for the new Bluetooth 5.0 module with the main controller",
                    "status": "not_started",
                    "priority": "medium",
                    "due_date": datetime.now() + timedelta(days=7)
                }
            ]
            
            # Insert tasks
            for task in tasks:
                task_id = str(uuid.uuid4())
                await db.execute(text("""
                    INSERT INTO tasks (id, name, description, status, priority, due_date, project_id, created_at)
                    VALUES (:id, :name, :description, :status, :priority, :due_date, :project_id, :created_at)
                """), {
                    "id": task_id,
                    "name": task["name"],
                    "description": task["description"],
                    "status": task["status"],
                    "priority": task["priority"],
                    "due_date": task["due_date"],
                    "project_id": project_uuid,
                    "created_at": datetime.now()
                })
                print(f"✅ Added task: {task['name']}")
            
            await db.commit()
            print("✅ All sample tasks added successfully!")
                
        except Exception as e:
            print(f"❌ Error adding sample tasks: {e}")
            await db.rollback()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(add_sample_tasks())