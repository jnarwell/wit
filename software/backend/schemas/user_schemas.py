# Pydantic models cannot be directly used in response_model with SQLAlchemy models.
# We need a schema to convert the SQLAlchemy model to a Pydantic model.
from pydantic import BaseModel
import uuid

class User(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    is_active: bool
    is_admin: bool

    class Config:
        orm_mode = True
