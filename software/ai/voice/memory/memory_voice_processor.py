#!/usr/bin/env python3
"""
W.I.T. Voice Processor with Memory Integration

Enhanced voice processor that remembers everything about each user.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import hashlib

# Import the original voice processor
from software.ai.voice.claude_voice_processor import (
    ClaudeVoiceProcessor, ProcessingConfig, VoiceCommand,
    VoiceState, WorkshopVoiceAssistant
, Tuple)

# Import memory system
from software.ai.voice.memory.memory_system import MemoryManager, Conversation, Project, EquipmentLog

logger = logging.getLogger(__name__)


class MemoryEnabledVoiceProcessor(ClaudeVoiceProcessor):
    """Voice processor with persistent memory"""
    
    def __init__(self, config: ProcessingConfig, memory_db_path: str = "wit_memory.db"):
        super().__init__(config)
        self.memory_manager = MemoryManager(memory_db_path)
        self.current_session_id: Optional[str] = None
        self.current_user_id: Optional[str] = None
        
    async def identify_and_start_session(self, user_name: str) -> Tuple[str, str]:
        """Identify user and start session"""
        self.current_user_id = await self.memory_manager.identify_user(name=user_name)
        self.current_session_id = await self.memory_manager.start_session(self.current_user_id)
        
        logger.info(f"Session started for user: {user_name} (ID: {self.current_user_id})")
        return self.current_user_id, self.current_session_id
        
    async def understand_with_memory(
        self, text: str, 
        additional_context: Optional[Dict[str, Any]] = None
    ) -> VoiceCommand:
        """Process command with full user context"""
        if not self.current_user_id:
            # Default to guest if no user identified
            self.current_user_id = "guest"
            self.current_session_id = await self.memory_manager.start_session("guest")
            
        # Get user context
        context = await self.memory_manager.db.build_user_context(self.current_user_id)
        
        # Create enhanced prompt
        enhanced_prompt = self._build_contextual_prompt(text, context)
        
        # Merge contexts
        full_context = {
            'user_memory': context,
            'session_id': self.current_session_id,
            **(additional_context or {})
        }
        
        # Process with original method but enhanced prompt
        result = await self.understand_with_claude(enhanced_prompt, full_context)
        
        # Save to memory
        await self._save_to_memory(text, result, context)
        
        return result
        
    def _build_contextual_prompt(self, command: str, context: Dict[str, Any]) -> str:
        """Build prompt with user context"""
        prompt_parts = []
        
        # User info
        user_info = context.get('user', {})
        if user_info.get('name') and user_info['name'] != 'Unknown':
            prompt_parts.append(f"User: {user_info['name']} (Skill: {user_info.get('skill_level', 'unknown')})")
            
        # Active project
        if context.get('active_project'):
            project = context['active_project']
            prompt_parts.append(f"Current Project: {project['name']} - {project['description']}")
            if project.get('equipment_used'):
                prompt_parts.append(f"Equipment being used: {', '.join(project['equipment_used'])}")
                
        # Recent context
        if context.get('recent_conversations'):
            recent = context['recent_conversations'][:3]
            prompt_parts.append("\nRecent commands:")
            for conv in recent:
                prompt_parts.append(f"- {conv['command']} ({conv['intent']})")
                
        # Learned preferences
        if context.get('learned_preferences'):
            prefs = [p['content'] for p in context['learned_preferences'][:5]]
            prompt_parts.append(f"\nKnown preferences: {', '.join(prefs)}")
            
        # Add the actual command
        prompt_parts.append(f"\nCurrent command: {command}")
        prompt_parts.append("\nProvide personalized help based on their history and current project.")
        
        return "\n".join(prompt_parts)
        
    async def _save_to_memory(
        self, command: str, result: VoiceCommand, context: Dict[str, Any]
    ):
        """Save interaction to memory"""
        conv_id = hashlib.md5(f"{self.current_session_id}_{datetime.now()}".encode()).hexdigest()[:12]
        
        conversation = Conversation(
            conversation_id=conv_id,
            user_id=self.current_user_id,
            session_id=self.current_session_id,
            timestamp=result.timestamp,
            command=command,
            intent=result.intent,
            entities=result.entities,
            response=result.claude_response or "",
            context=context,
            project_id=context.get('active_project', {}).get('project_id') if context.get('active_project') else None,
            equipment_id=result.entities.get('equipment')
        )
        
        await self.memory_manager.db.save_conversation(conversation)
        
        # Log equipment usage if applicable
        if result.intent == "control_equipment" and result.entities.get('equipment'):
            log_id = hashlib.md5(f"{self.current_user_id}_{datetime.now()}".encode()).hexdigest()[:12]
            
            equipment_log = EquipmentLog(
                log_id=log_id,
                user_id=self.current_user_id,
                equipment_id=result.entities['equipment'],
                action=result.entities.get('action', 'unknown'),
                parameters=result.entities.get('parameters', {}),
                timestamp=datetime.now(),
                duration=0.0,
                project_id=conversation.project_id
            )
            
            await self.memory_manager.db.log_equipment_usage(equipment_log)
            
        # Learn from interaction
        await self._learn_from_interaction(conversation)
        
    async def _learn_from_interaction(self, conversation: Conversation):
        """Extract learnings from interaction"""
        # Temperature preferences
        if 'temperature' in conversation.command.lower():
            unit = 'celsius' if 'celsius' in conversation.command.lower() else 'fahrenheit'
            await self.memory_manager.db.save_learning_insight(
                self.current_user_id,
                'unit_preference',
                f'Prefers {unit} for temperature',
                0.8
            )
            
        # Equipment preferences
        if conversation.equipment_id:
            await self.memory_manager.db.save_learning_insight(
                self.current_user_id,
                'equipment_usage',
                f'Frequently uses {conversation.equipment_id}',
                0.7
            )
            
        # Time of day patterns
        hour = conversation.timestamp.hour
        if 6 <= hour < 12:
            time_period = "morning"
        elif 12 <= hour < 17:
            time_period = "afternoon"
        elif 17 <= hour < 22:
            time_period = "evening"
        else:
            time_period = "night"
            
        await self.memory_manager.db.save_learning_insight(
            self.current_user_id,
            'usage_pattern',
            f'Often works in the {time_period}',
            0.6
        )


class MemoryWorkshopAssistant(WorkshopVoiceAssistant):
    """Workshop assistant with memory capabilities"""
    
    def __init__(self, voice_processor: MemoryEnabledVoiceProcessor):
        self.processor = voice_processor
        self._setup_handlers()
        self._setup_memory_handlers()
        
    def _setup_memory_handlers(self):
        """Setup memory-specific command handlers"""
        self.processor.register_command_handler("create_project", self._handle_create_project)
        self.processor.register_command_handler("project_status", self._handle_project_status)
        self.processor.register_command_handler("recall_conversation", self._handle_recall)
        self.processor.register_command_handler("my_preferences", self._handle_preferences)
        
    async def _handle_create_project(self, command: VoiceCommand):
        """Handle project creation"""
        project_name = command.entities.get('project_name', 'Untitled Project')
        description = command.entities.get('description', '')
        
        project = await self.processor.memory_manager.db.create_project(
            self.processor.current_user_id,
            project_name,
            description
        )
        
        logger.info(f"Created project: {project.name} for user {self.processor.current_user_id}")
        
    async def _handle_project_status(self, command: VoiceCommand):
        """Get current project status"""
        project = await self.processor.memory_manager.db.get_active_project(
            self.processor.current_user_id
        )
        
        if project:
            logger.info(f"Active project: {project.name} - {project.status}")
        else:
            logger.info("No active project")
            
    async def _handle_recall(self, command: VoiceCommand):
        """Recall past conversations"""
        query = command.entities.get('query', '')
        
        if query:
            # Semantic search
            results = await self.processor.memory_manager.db.search_conversations(
                self.processor.current_user_id,
                query,
                limit=3
            )
        else:
            # Get recent
            results = await self.processor.memory_manager.db.get_conversation_history(
                self.processor.current_user_id,
                limit=5
            )
            
        logger.info(f"Found {len(results)} matching conversations")
        
    async def _handle_preferences(self, command: VoiceCommand):
        """Show user preferences"""
        insights = await self.processor.memory_manager.db.get_user_insights(
            self.processor.current_user_id
        )
        
        logger.info(f"User has {len(insights)} learned preferences")


# Enhanced command processing
async def process_command_with_memory(
    user_name: str,
    command: str,
    api_key: str
) -> Dict[str, Any]:
    """Process a command with full memory context"""
    config = ProcessingConfig(
        anthropic_api_key=api_key,
        claude_model="claude-3-5-sonnet-20241022"
    )
    
    processor = MemoryEnabledVoiceProcessor(config)
    assistant = MemoryWorkshopAssistant(processor)
    
    await processor.start()
    
    # Identify user and start session
    user_id, session_id = await processor.identify_and_start_session(user_name)
    
    # Process with memory
    result = await processor.understand_with_memory(command)
    
    return {
        'user_id': user_id,
        'session_id': session_id,
        'command': command,
        'intent': result.intent,
        'entities': result.entities,
        'response': result.claude_response,
        'timestamp': result.timestamp.isoformat()
    }


if __name__ == "__main__":
    # Test the memory system
    async def test():
        import os
        
        # Test commands
        commands = [
            ("James", "Start my 3D printer project"),
            ("James", "Set the printer temperature to 220 degrees"),
            ("James", "What was I working on yesterday?"),
            ("Sarah", "I'm new here, can you help me get started?"),
            ("James", "Show me my recent commands"),
        ]
        
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        
        for user, command in commands:
            print(f"\n{'='*50}")
            print(f"User: {user}")
            print(f"Command: {command}")
            
            result = await process_command_with_memory(user, command, api_key)
            
            print(f"Intent: {result['intent']}")
            print(f"Response: {result['response'][:200]}...")
            
    asyncio.run(test())