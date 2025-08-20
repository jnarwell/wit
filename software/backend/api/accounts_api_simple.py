"""
Simple accounts API for development
Returns empty linked accounts to satisfy frontend requirements
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import List, Optional
from pydantic import BaseModel
import os

# Use the same JWT settings as dev_server
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])

# In-memory storage for connected accounts (dev mode only)
connected_accounts_store = {}

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None
    is_admin: Optional[bool] = False
    is_active: Optional[bool] = True

# Simple authentication dependency that matches dev_server
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # In dev mode, just return a simple user object
    return User(username=username, is_active=True)

@router.get("/linked")
async def get_linked_accounts(current_user: User = Depends(get_current_user)):
    """Get all linked accounts for the current user"""
    # Return accounts from our in-memory store
    user_accounts = connected_accounts_store.get(current_user.username, [])
    return user_accounts

@router.post("/link/{provider}")
async def link_account(provider: str, current_user: User = Depends(get_current_user)):
    """Initiate OAuth flow for linking an account"""
    # In development, return a placeholder response
    return {
        "auth_url": f"http://localhost:8000/api/v1/auth/{provider}/callback",
        "state": "dev-state-placeholder"
    }

@router.delete("/unlink/{provider}")
async def unlink_account(provider: str, current_user: User = Depends(get_current_user)):
    """Unlink a connected account"""
    return {"message": f"{provider} account unlinked successfully"}