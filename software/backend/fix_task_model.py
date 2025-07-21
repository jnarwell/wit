#!/usr/bin/env python3
"""Add Task model to database_models.py"""

# Read the current file
with open("models/database_models.py", "r") as f:
    content = f.read()

# Check if Task model exists
if "class Task(" not in content:
    print("Task model is missing. Adding it...")
    
    # Find a good place to insert (after Project model if it exists)
    task_model = '''

class Task(Base):
    """Task model for project tasks"""
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="medium")
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships (add these to Project and User models too)
    # project = relationship("Project", back_populates="tasks")
    # assigned_user = relationship("User", back_populates="tasks")
'''
    
    # Insert after Project class or at the end
    if "class Project(" in content:
        # Find the end of Project class
        lines = content.split('\n')
        insert_line = 0
        in_project = False
        indent_level = 0
        
        for i, line in enumerate(lines):
            if "class Project(" in line:
                in_project = True
                indent_level = len(line) - len(line.lstrip())
            elif in_project and line.strip() and len(line) - len(line.lstrip()) <= indent_level:
                # Found the end of Project class
                insert_line = i
                break
        
        if insert_line > 0:
            lines.insert(insert_line, task_model)
            content = '\n'.join(lines)
    else:
        # Just append to the end
        content += task_model
    
    # Write back
    with open("models/database_models.py", "w") as f:
        f.write(content)
    
    print("✅ Added Task model")
else:
    print("✅ Task model already exists")

# Also check for other required imports
if "from datetime import datetime" not in content:
    # Add datetime import at the top
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('from sqlalchemy'):
            lines.insert(i, 'from datetime import datetime')
            break
    
    with open("models/database_models.py", "w") as f:
        f.write('\n'.join(lines))
    
    print("✅ Added datetime import")
