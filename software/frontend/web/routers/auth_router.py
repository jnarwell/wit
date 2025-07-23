"""
Working authentication router
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from software.backend.services.database_services import get_session
from software.backend.models.database_models import User
from software.backend.auth.security import verify_password, create_access_token

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

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
    stmt = select(User).where(User.username == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    # Verify user and password
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is disabled"
        )
    
    # Create token
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=30)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def read_users_me(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
):
    """Get current user"""
    # Simplified - in production you'd decode the token
    return {
        "username": "admin",
        "email": "admin@wit.local",
        "is_active": True,
        "is_admin": True
    }

@router.get("/status")
async def auth_status():
    """Auth system status"""
    return {"status": "operational"}

@router.get("/")
async def get_auth():
    """Auth info"""
    return {"login": "/api/v1/auth/token", "type": "OAuth2"}

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
    stmt = select(User).where(User.username == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    # Verify user and password
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is disabled"
        )
    
    # Create token
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=30)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def read_users_me(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
):
    """Get current user"""
    # Simplified - in production you'd decode the token
    return {
        "username": "admin",
        "email": "admin@wit.local",
        "is_active": True,
        "is_admin": True
    }

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