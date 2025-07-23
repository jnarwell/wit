from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from software.backend.services.database_services import get_session, User as DBUser, get_user_by_username
from software.backend.schemas.user_schemas import User
from software.backend.auth.security import verify_password, create_access_token, decode_access_token
import logging

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

logger = logging.getLogger(__name__)

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/token", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_session)
):
    """OAuth2 compatible token login"""
    # Query user
    stmt = select(DBUser).where(DBUser.username == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    # Verify user and password
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    
    # Create token
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=30)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_users_me(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
):
    """Get current user's details."""
    username = decode_access_token(token)
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await get_user_by_username(db, username=username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return user

@router.get("/status")
async def auth_status():
    """Auth system status"""
    return {"status": "operational"}

@router.get("/")
async def get_auth():
    """Auth info"""
    return {"login": "/api/v1/auth/token", "type": "OAuth2"}

@router.get("/user_id/{username}")
async def get_user_id(username: str, db: AsyncSession = Depends(get_session)):
    """Get user ID by username (for testing)"""
    logger.info(f"--- Entering get_user_id endpoint for username: {username} ---")
    try:
        logger.info("1. Executing query to find user...")
        user = await db.execute(select(User).where(User.username == username))
        user = user.scalar_one_or_none()
        logger.info(f"2. Query executed. User found: {user}")
        
        if not user:
            logger.warning("   - User not found in database.")
            raise HTTPException(status_code=404, detail="User not found")
            
        logger.info(f"3. Returning user ID: {user.id}")
        logger.info("--- Exiting get_user_id endpoint successfully ---")
        return {"user_id": user.id}

    except Exception as e:
        logger.error(f"--- CRASH in get_user_id endpoint ---")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e}", exc_info=True)
        # Re-raise the exception to let FastAPI handle the 500 error
        raise