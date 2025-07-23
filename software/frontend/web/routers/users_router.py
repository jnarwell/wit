# src/routers/users_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from software.backend.services.database_services import get_session, create_user

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

@router.post("/", status_code=201)
async def post_create_user(
    user: UserCreate, 
    db: AsyncSession = Depends(get_session)
):
    """Creates a new user."""
    db_user = await create_user(
        db=db,
        username=user.username,
        email=user.email,
        password=user.password
    )
    if not db_user:
        raise HTTPException(status_code=400, detail="Could not create user.")
    return {"message": "User created successfully"}
