#!/usr/bin/env python3
"""
Simple SQLite connection test

File: software/backend/test_sqlite_simple.py
"""

import asyncio
import sqlite3
from pathlib import Path

async def test_sqlite():
    """Test basic SQLite functionality"""
    print("=== SQLite Connection Test ===\n")
    
    # Create data directory
    Path("data").mkdir(exist_ok=True)
    
    # Test 1: Basic connection
    try:
        conn = sqlite3.connect("data/wit_local.db")
        cursor = conn.cursor()
        
        # Create a test table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_table (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert test data
        cursor.execute("INSERT INTO test_table (name) VALUES (?)", ("Test Entry",))
        conn.commit()
        
        # Query data
        cursor.execute("SELECT COUNT(*) FROM test_table")
        count = cursor.fetchone()[0]
        
        print(f"✓ SQLite connection successful")
        print(f"✓ Test table created")
        print(f"✓ Test data inserted (total rows: {count})")
        
        conn.close()
        
    except Exception as e:
        print(f"✗ SQLite error: {e}")
        return False
    
    # Test 2: Async SQLite with aiosqlite
    try:
        import aiosqlite
        
        async with aiosqlite.connect("data/wit_local.db") as db:
            async with db.execute("SELECT name FROM test_table LIMIT 1") as cursor:
                row = await cursor.fetchone()
                if row:
                    print(f"✓ Async SQLite working (found: {row[0]})")
        
    except ImportError:
        print("✗ aiosqlite not installed - run: pip install aiosqlite")
        return False
    except Exception as e:
        print(f"✗ Async SQLite error: {e}")
        return False
    
    # Test 3: SQLAlchemy connection
    try:
        from sqlalchemy import create_engine, text
        
        engine = create_engine("sqlite:///data/wit_local.db")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            if result.scalar() == 1:
                print("✓ SQLAlchemy connection successful")
        
    except ImportError:
        print("✗ SQLAlchemy not installed - run: pip install sqlalchemy")
        return False
    except Exception as e:
        print(f"✗ SQLAlchemy error: {e}")
        return False
    
    print("\n✓ All SQLite tests passed!")
    print("\nDatabase file created at: data/wit_local.db")
    return True

if __name__ == "__main__":
    asyncio.run(test_sqlite())