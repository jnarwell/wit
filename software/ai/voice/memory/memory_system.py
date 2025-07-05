#!/usr/bin/env python3
"""
W.I.T. Memory System - Complete User Context & History

Provides persistent memory for:
- User profiles and preferences
- Complete conversation history
- Project details and progress
- Equipment usage patterns
- Learning from past interactions
"""

import json
import sqlite3
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib
from enum import Enum

# For vector embeddings (semantic search)
import numpy as np
from sentence_transformers import SentenceTransformer

@dataclass
class User:
    """User profile with preferences and settings"""
    user_id: str
    name: str
    created_at: datetime
    preferences: Dict[str, Any]
    equipment_access: List[str]
    skill_level: str
    voice_profile: Dict[str, Any]

@dataclass
class Project:
    """Workshop project tracking"""
    project_id: str
    user_id: str
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    status: str
    equipment_used: List[str]
    materials: Dict[str, Any]
    files: List[str]
    notes: List[Dict[str, Any]]
    time_spent: float

@dataclass
class Conversation:
    """Conversation history entry"""
    conversation_id: str
    user_id: str
    session_id: str
    timestamp: datetime
    command: str
    intent: str
    entities: Dict[str, Any]
    response: str
    context: Dict[str, Any]
    project_id: Optional[str] = None
    equipment_id: Optional[str] = None

@dataclass
class EquipmentLog:
    """Equipment usage history"""
    log_id: str
    user_id: str
    equipment_id: str
    action: str
    parameters: Dict[str, Any]
    timestamp: datetime
    duration: float
    project_id: Optional[str] = None
    notes: Optional[str] = None

class MemoryDatabase:
    """SQLite database for persistent memory"""
    
    def __init__(self, db_path: str = "wit_memory.db"):
        self.db_path = db_path
        self.conn = None
        self.embedding_model = None
        self._init_database()
        
    def _init_database(self):
        """Initialize database tables"""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        
        # Users table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                preferences TEXT,
                equipment_access TEXT,
                skill_level TEXT,
                voice_profile TEXT
            )
        """)
        
        # Projects table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                project_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT,
                equipment_used TEXT,
                materials TEXT,
                files TEXT,
                notes TEXT,
                time_spent REAL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        """)
        
        # Conversations table with embeddings
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                conversation_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                command TEXT NOT NULL,
                intent TEXT,
                entities TEXT,
                response TEXT,
                context TEXT,
                project_id TEXT,
                equipment_id TEXT,
                embedding BLOB,
                FOREIGN KEY (user_id) REFERENCES users (user_id),
                FOREIGN KEY (project_id) REFERENCES projects (project_id)
            )
        """)
        
        # Equipment usage logs
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS equipment_logs (
                log_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                equipment_id TEXT NOT NULL,
                action TEXT NOT NULL,
                parameters TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duration REAL DEFAULT 0,
                project_id TEXT,
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users (user_id),
                FOREIGN KEY (project_id) REFERENCES projects (project_id)
            )
        """)
        
        # Learning insights table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS learning_insights (
                insight_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                insight_type TEXT NOT NULL,
                content TEXT NOT NULL,
                confidence REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP,
                usage_count INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        """)
        
        self.conn.commit()
        
    def _get_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for semantic search"""
        if self.embedding_model is None:
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        return self.embedding_model.encode(text)
        
    # User Management
    async def create_user(self, name: str, voice_sample: Optional[bytes] = None) -> User:
        """Create new user profile"""
        user_id = hashlib.md5(f"{name}_{datetime.now()}".encode()).hexdigest()[:12]
        
        user = User(
            user_id=user_id,
            name=name,
            created_at=datetime.now(),
            preferences={
                "units": "metric",
                "safety_level": "standard",
                "verbosity": "normal",
                "preferred_equipment": []
            },
            equipment_access=["3d_printer", "laser_cutter", "cnc_mill"],
            skill_level="intermediate",
            voice_profile={"sample": voice_sample is not None}
        )
        
        self.conn.execute("""
            INSERT INTO users (user_id, name, preferences, equipment_access, skill_level, voice_profile)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            user.user_id, user.name, 
            json.dumps(user.preferences), json.dumps(user.equipment_access),
            user.skill_level, json.dumps(user.voice_profile)
        ))
        self.conn.commit()
        
        return user
        
    async def get_user(self, user_id: str) -> Optional[User]:
        """Retrieve user profile"""
        row = self.conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if row:
            return User(
                user_id=row['user_id'],
                name=row['name'],
                created_at=datetime.fromisoformat(row['created_at']),
                preferences=json.loads(row['preferences']),
                equipment_access=json.loads(row['equipment_access']),
                skill_level=row['skill_level'],
                voice_profile=json.loads(row['voice_profile'])
            )
        return None
        
    # Conversation Memory
    async def save_conversation(self, conv: Conversation):
        """Save conversation to history"""
        # Generate embedding for semantic search
        embedding = self._get_embedding(f"{conv.command} {conv.response}")
        
        self.conn.execute("""
            INSERT INTO conversations 
            (conversation_id, user_id, session_id, timestamp, command, intent, 
             entities, response, context, project_id, equipment_id, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            conv.conversation_id, conv.user_id, conv.session_id,
            conv.timestamp.isoformat(), conv.command, conv.intent,
            json.dumps(conv.entities), conv.response, json.dumps(conv.context),
            conv.project_id, conv.equipment_id, embedding.tobytes()
        ))
        self.conn.commit()
        
    async def get_conversation_history(
        self, user_id: str, limit: int = 10, 
        project_id: Optional[str] = None
    ) -> List[Conversation]:
        """Retrieve conversation history"""
        query = "SELECT * FROM conversations WHERE user_id = ?"
        params = [user_id]
        
        if project_id:
            query += " AND project_id = ?"
            params.append(project_id)
            
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        rows = self.conn.execute(query, params).fetchall()
        
        conversations = []
        for row in rows:
            conversations.append(Conversation(
                conversation_id=row['conversation_id'],
                user_id=row['user_id'],
                session_id=row['session_id'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                command=row['command'],
                intent=row['intent'],
                entities=json.loads(row['entities']),
                response=row['response'],
                context=json.loads(row['context']),
                project_id=row['project_id'],
                equipment_id=row['equipment_id']
            ))
            
        return conversations
        
    async def search_conversations(
        self, user_id: str, query: str, limit: int = 5
    ) -> List[Conversation]:
        """Semantic search through conversation history"""
        query_embedding = self._get_embedding(query)
        
        # Get all conversations with embeddings
        rows = self.conn.execute("""
            SELECT *, embedding FROM conversations 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 100
        """, (user_id,)).fetchall()
        
        # Calculate similarities
        results = []
        for row in rows:
            if row['embedding']:
                stored_embedding = np.frombuffer(row['embedding'], dtype=np.float32)
                similarity = np.dot(query_embedding, stored_embedding)
                results.append((similarity, row))
                
        # Sort by similarity and return top results
        results.sort(key=lambda x: x[0], reverse=True)
        
        conversations = []
        for _, row in results[:limit]:
            conversations.append(Conversation(
                conversation_id=row['conversation_id'],
                user_id=row['user_id'],
                session_id=row['session_id'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                command=row['command'],
                intent=row['intent'],
                entities=json.loads(row['entities']),
                response=row['response'],
                context=json.loads(row['context']),
                project_id=row['project_id'],
                equipment_id=row['equipment_id']
            ))
            
        return conversations
        
    # Project Management
    async def create_project(self, user_id: str, name: str, description: str) -> Project:
        """Create new project"""
        project_id = hashlib.md5(f"{user_id}_{name}_{datetime.now()}".encode()).hexdigest()[:12]
        
        project = Project(
            project_id=project_id,
            user_id=user_id,
            name=name,
            description=description,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            status="active",
            equipment_used=[],
            materials={},
            files=[],
            notes=[],
            time_spent=0.0
        )
        
        self.conn.execute("""
            INSERT INTO projects 
            (project_id, user_id, name, description, status, equipment_used, 
             materials, files, notes, time_spent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            project.project_id, project.user_id, project.name, project.description,
            project.status, json.dumps(project.equipment_used),
            json.dumps(project.materials), json.dumps(project.files),
            json.dumps(project.notes), project.time_spent
        ))
        self.conn.commit()
        
        return project
        
    async def get_active_project(self, user_id: str) -> Optional[Project]:
        """Get user's current active project"""
        row = self.conn.execute("""
            SELECT * FROM projects 
            WHERE user_id = ? AND status = 'active' 
            ORDER BY updated_at DESC 
            LIMIT 1
        """, (user_id,)).fetchone()
        
        if row:
            return Project(
                project_id=row['project_id'],
                user_id=row['user_id'],
                name=row['name'],
                description=row['description'],
                created_at=datetime.fromisoformat(row['created_at']),
                updated_at=datetime.fromisoformat(row['updated_at']),
                status=row['status'],
                equipment_used=json.loads(row['equipment_used']),
                materials=json.loads(row['materials']),
                files=json.loads(row['files']),
                notes=json.loads(row['notes']),
                time_spent=row['time_spent']
            )
        return None
        
    async def update_project(self, project: Project):
        """Update project details"""
        project.updated_at = datetime.now()
        
        self.conn.execute("""
            UPDATE projects SET
            name = ?, description = ?, updated_at = ?, status = ?,
            equipment_used = ?, materials = ?, files = ?, notes = ?, time_spent = ?
            WHERE project_id = ?
        """, (
            project.name, project.description, project.updated_at.isoformat(),
            project.status, json.dumps(project.equipment_used),
            json.dumps(project.materials), json.dumps(project.files),
            json.dumps(project.notes), project.time_spent, project.project_id
        ))
        self.conn.commit()
        
    # Equipment Tracking
    async def log_equipment_usage(self, log: EquipmentLog):
        """Log equipment usage"""
        self.conn.execute("""
            INSERT INTO equipment_logs
            (log_id, user_id, equipment_id, action, parameters, 
             timestamp, duration, project_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log.log_id, log.user_id, log.equipment_id, log.action,
            json.dumps(log.parameters), log.timestamp.isoformat(),
            log.duration, log.project_id, log.notes
        ))
        self.conn.commit()
        
    async def get_equipment_history(
        self, user_id: str, equipment_id: str, days: int = 30
    ) -> List[EquipmentLog]:
        """Get equipment usage history"""
        cutoff = datetime.now() - timedelta(days=days)
        
        rows = self.conn.execute("""
            SELECT * FROM equipment_logs
            WHERE user_id = ? AND equipment_id = ? AND timestamp > ?
            ORDER BY timestamp DESC
        """, (user_id, equipment_id, cutoff.isoformat())).fetchall()
        
        logs = []
        for row in rows:
            logs.append(EquipmentLog(
                log_id=row['log_id'],
                user_id=row['user_id'],
                equipment_id=row['equipment_id'],
                action=row['action'],
                parameters=json.loads(row['parameters']),
                timestamp=datetime.fromisoformat(row['timestamp']),
                duration=row['duration'],
                project_id=row['project_id'],
                notes=row['notes']
            ))
            
        return logs
        
    # Learning & Insights
    async def save_learning_insight(
        self, user_id: str, insight_type: str, content: str, confidence: float
    ):
        """Save learned pattern or preference"""
        insight_id = hashlib.md5(f"{user_id}_{content}_{datetime.now()}".encode()).hexdigest()[:12]
        
        self.conn.execute("""
            INSERT INTO learning_insights
            (insight_id, user_id, insight_type, content, confidence, last_used)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            insight_id, user_id, insight_type, content, confidence,
            datetime.now().isoformat()
        ))
        self.conn.commit()
        
    async def get_user_insights(self, user_id: str) -> List[Dict[str, Any]]:
        """Get learned insights about user"""
        rows = self.conn.execute("""
            SELECT * FROM learning_insights
            WHERE user_id = ?
            ORDER BY confidence DESC, usage_count DESC
            LIMIT 20
        """, (user_id,)).fetchall()
        
        insights = []
        for row in rows:
            insights.append({
                'type': row['insight_type'],
                'content': row['content'],
                'confidence': row['confidence'],
                'usage_count': row['usage_count']
            })
            
        return insights
        
    # Context Building
    async def build_user_context(self, user_id: str) -> Dict[str, Any]:
        """Build comprehensive context for Claude"""
        user = await self.get_user(user_id)
        if not user:
            return {}
            
        # Get recent conversations
        recent_convs = await self.get_conversation_history(user_id, limit=20)
        
        # Get active project
        active_project = await self.get_active_project(user_id)
        
        # Get user insights
        insights = await self.get_user_insights(user_id)
        
        # Get recent equipment usage
        equipment_usage = {}
        for equipment in user.equipment_access:
            logs = await self.get_equipment_history(user_id, equipment, days=7)
            if logs:
                equipment_usage[equipment] = {
                    'last_used': logs[0].timestamp.isoformat(),
                    'recent_actions': [log.action for log in logs[:5]]
                }
                
        context = {
            'user': {
                'name': user.name,
                'skill_level': user.skill_level,
                'preferences': user.preferences,
                'equipment_access': user.equipment_access
            },
            'active_project': {
                'name': active_project.name,
                'description': active_project.description,
                'equipment_used': active_project.equipment_used,
                'time_spent': active_project.time_spent,
                'recent_notes': active_project.notes[-3:] if active_project.notes else []
            } if active_project else None,
            'recent_conversations': [
                {
                    'command': conv.command,
                    'intent': conv.intent,
                    'response': conv.response[:100] + '...' if len(conv.response) > 100 else conv.response
                }
                for conv in recent_convs[:5]
            ],
            'equipment_usage': equipment_usage,
            'learned_preferences': insights,
            'conversation_count': len(recent_convs),
            'projects_count': self.conn.execute(
                "SELECT COUNT(*) FROM projects WHERE user_id = ?", (user_id,)
            ).fetchone()[0]
        }
        
        return context


class MemoryManager:
    """High-level memory management interface"""
    
    def __init__(self, db_path: str = "wit_memory.db"):
        self.db = MemoryDatabase(db_path)
        self.active_sessions: Dict[str, str] = {}  # session_id -> user_id
        
    async def identify_user(self, voice_sample: Optional[bytes] = None, name: Optional[str] = None) -> str:
        """Identify or create user"""
        # In production, use voice biometrics for identification
        # For now, use name-based identification
        
        if name:
            # Check if user exists
            users = self.db.conn.execute(
                "SELECT user_id FROM users WHERE name = ?", (name,)
            ).fetchall()
            
            if users:
                return users[0]['user_id']
            else:
                # Create new user
                user = await self.db.create_user(name, voice_sample)
                return user.user_id
                
        # Default to guest user
        return "guest"
        
    async def start_session(self, user_id: str) -> str:
        """Start new conversation session"""
        session_id = hashlib.md5(f"{user_id}_{datetime.now()}".encode()).hexdigest()[:12]
        self.active_sessions[session_id] = user_id
        return session_id
        
    async def process_with_memory(
        self, session_id: str, command: str, 
        voice_processor, anthropic_api_key: str
    ) -> Dict[str, Any]:
        """Process command with full context"""
        user_id = self.active_sessions.get(session_id, "guest")
        
        # Build context
        context = await self.db.build_user_context(user_id)
        
        # Create enhanced prompt with context
        enhanced_prompt = f"""
You are W.I.T., a workshop assistant with memory of this user's history.

USER CONTEXT:
- Name: {context['user'].get('name', 'Unknown')}
- Skill Level: {context['user'].get('skill_level', 'Unknown')}
- Preferences: {json.dumps(context['user'].get('preferences', {}))}

CURRENT PROJECT: {context.get('active_project', {}).get('name', 'No active project')}
{context.get('active_project', {}).get('description', '')}

RECENT CONVERSATIONS:
{json.dumps(context.get('recent_conversations', []), indent=2)}

LEARNED PREFERENCES:
{json.dumps(context.get('learned_preferences', []), indent=2)}

USER COMMAND: {command}

Respond naturally, using the context to provide personalized help. Reference past conversations and projects when relevant.
"""
        
        # Process with Claude
        result = await voice_processor.understand_with_claude(
            enhanced_prompt,
            {'session_id': session_id, 'user_context': context}
        )
        
        # Save to memory
        conv_id = hashlib.md5(f"{session_id}_{datetime.now()}".encode()).hexdigest()[:12]
        conversation = Conversation(
            conversation_id=conv_id,
            user_id=user_id,
            session_id=session_id,
            timestamp=datetime.now(),
            command=command,
            intent=result.intent,
            entities=result.entities,
            response=result.claude_response or "",
            context=context,
            project_id=context.get('active_project', {}).get('project_id') if context.get('active_project') else None
        )
        
        await self.db.save_conversation(conversation)
        
        # Learn from interaction
        await self._learn_from_interaction(user_id, conversation)
        
        return {
            'response': result.claude_response,
            'intent': result.intent,
            'entities': result.entities,
            'context_used': True,
            'user_name': context['user'].get('name', 'Unknown')
        }
        
    async def _learn_from_interaction(self, user_id: str, conversation: Conversation):
        """Extract learnings from interaction"""
        # Example: Learn equipment preferences
        if conversation.intent == "control_equipment" and conversation.entities.get('equipment'):
            equipment = conversation.entities['equipment']
            await self.db.save_learning_insight(
                user_id,
                'equipment_preference',
                f"Frequently uses {equipment}",
                0.7
            )
            
        # Learn command patterns
        if 'temperature' in conversation.command.lower():
            if 'celsius' in conversation.command.lower():
                await self.db.save_learning_insight(
                    user_id,
                    'unit_preference',
                    'Prefers Celsius for temperature',
                    0.8
                )
                
        # Project-related learning
        if conversation.project_id:
            await self.db.save_learning_insight(
                user_id,
                'project_focus',
                f"Working on project: {conversation.project_id}",
                0.9
            )


# Example usage
if __name__ == "__main__":
    async def test_memory_system():
        # Initialize memory manager
        memory_mgr = MemoryManager()
        
        # Identify user
        user_id = await memory_mgr.identify_user(name="James")
        print(f"User ID: {user_id}")
        
        # Start session
        session_id = await memory_mgr.start_session(user_id)
        print(f"Session ID: {session_id}")
        
        # Create a project
        project = await memory_mgr.db.create_project(
            user_id,
            "Custom Enclosure",
            "Building a custom enclosure for the workshop computer"
        )
        print(f"Created project: {project.name}")
        
        # Build context
        context = await memory_mgr.db.build_user_context(user_id)
        print(f"User context: {json.dumps(context, indent=2)}")
        
    asyncio.run(test_memory_system())