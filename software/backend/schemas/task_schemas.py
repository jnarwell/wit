# software/backend/schemas/task_schemas.py
from pydantic import BaseModel
import uuid

class TaskBase(BaseModel):
    name: str
    description: str | None = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None

class TaskResponse(TaskBase):
    id: uuid.UUID
    status: str
    project_id: uuid.UUID

    class Config:
        orm_mode = True