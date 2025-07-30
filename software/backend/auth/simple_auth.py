"""
Simple auth endpoints that bypass ORM issues
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import timedelta
import logging

from services.database_services import get_session
from .security import verify_password, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)

@router.post("/simple-token")
async def simple_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_session)
):
    """Simple login that uses raw SQL to avoid ORM issues"""
    logger.info(f"Simple login attempt for: {form_data.username}")
    
    # Use raw SQL to avoid ORM issues
    result = await db.execute(
        text("SELECT id, username, hashed_password, is_active FROM users WHERE username = :username"),
        {"username": form_data.username}
    )
    user = result.fetchone()
    
    if not user:
        logger.warning(f"User {form_data.username} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Invalid password for {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if active
    if not user.is_active:
        logger.warning(f"User {form_data.username} is not active")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create token
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=30)
    )
    
    logger.info(f"Login successful for {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}