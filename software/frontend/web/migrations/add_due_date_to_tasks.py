"""
Add due_date column to tasks table
"""
import asyncio
from sqlalchemy import text
from software.backend.services.database_services import get_session

async def add_due_date_column():
    """Add due_date column to tasks table if it doesn't exist"""
    async for db in get_session():
        try:
            # For SQLite, use PRAGMA to check columns
            result = await db.execute(text("PRAGMA table_info(tasks)"))
            columns = result.fetchall()
            
            # Check if due_date column exists
            column_names = [col[1] for col in columns]
            
            if 'due_date' not in column_names:
                # Add the column
                await db.execute(text("""
                    ALTER TABLE tasks 
                    ADD COLUMN due_date TIMESTAMP
                """))
                await db.commit()
                print("✅ Added due_date column to tasks table")
            else:
                print("✅ due_date column already exists")
                
        except Exception as e:
            print(f"❌ Error adding due_date column: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(add_due_date_column())