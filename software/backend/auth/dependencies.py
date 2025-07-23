"""
W.I.T. Authentication Dependencies

File: software/backend/auth/dependencies.py

FastAPI dependencies for authentication
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from ..services.database_services import get_session
from ..models.database_models_extended import User
from .security import decode_access_token

# Security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_session)
) -> User:
    """Get the current authenticated user"""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Extract token
    token = credentials.credentials
    
    # Decode token
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception
    
    # Get user from database
    try:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if user is None:
            raise credentials_exception
            
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user"
            )
            
        return user
        
    except Exception:
        raise credentials_exception


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the current user is active"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the current user is an admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Optional: For endpoints that can work with or without authentication
async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """Get the current user if authenticated, otherwise None"""
    
    if not credentials:
        return None
    
    try:
        # Decode token
        user_id = decode_access_token(credentials.credentials)
        if user_id is None:
            return None
        
        # Get user from database
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if user and user.is_active:
            return user
            
    except Exception:
        pass
    
    return None