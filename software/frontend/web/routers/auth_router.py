from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import secrets
import uuid
import os

from software.backend.services.database_services import get_session, User as DBUser, get_user_by_username, create_user
from software.backend.schemas.user_schemas import User
from software.backend.auth.security import verify_password, create_access_token, decode_access_token
import logging

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

logger = logging.getLogger(__name__)

class Token(BaseModel):
    access_token: str
    token_type: str

class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class SignupResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None

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

# Email verification storage (in production, use Redis or database)
email_verification_tokens = {}

async def send_verification_email(email: str, token: str):
    """Send verification email (placeholder for actual email service)"""
    # In production, integrate with email service like SendGrid, AWS SES, etc.
    verification_link = f"http://localhost:8000/api/v1/auth/verify-email?token={token}"
    
    # For development: Log the verification link
    logger.info("=" * 80)
    logger.info("EMAIL VERIFICATION LINK (Development Mode)")
    logger.info("=" * 80)
    logger.info(f"To: {email}")
    logger.info(f"Verification Link: {verification_link}")
    logger.info("=" * 80)
    logger.info("Copy and paste this link in your browser to verify your email")
    logger.info("=" * 80)
    
    # For development: Write to a file for easy access
    try:
        import os
        from datetime import datetime
        
        # Create a directory for verification emails if it doesn't exist
        email_dir = "dev_emails"
        os.makedirs(email_dir, exist_ok=True)
        
        # Write the verification email to a file
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{email_dir}/verification_{timestamp}_{email.replace('@', '_at_')}.txt"
        
        with open(filename, 'w') as f:
            f.write(f"Subject: Verify your W.I.T. account\n")
            f.write(f"To: {email}\n")
            f.write(f"Date: {datetime.utcnow().isoformat()}\n")
            f.write("\n")
            f.write("Welcome to W.I.T.!\n\n")
            f.write("Please click the link below to verify your email address:\n\n")
            f.write(f"{verification_link}\n\n")
            f.write("This link will expire in 24 hours.\n\n")
            f.write("If you didn't create an account, you can safely ignore this email.\n\n")
            f.write("Best regards,\nThe W.I.T. Team\n")
        
        logger.info(f"Verification email saved to: {filename}")
        
        # Optional: Open the link in browser automatically (for development)
        if os.getenv("AUTO_OPEN_VERIFICATION", "false").lower() == "true":
            import webbrowser
            webbrowser.open(verification_link)
            
    except Exception as e:
        logger.error(f"Failed to save verification email: {e}")
    
    # TODO: In production, implement actual email sending with SendGrid, AWS SES, etc.

@router.post("/signup", response_model=SignupResponse)
async def signup(
    signup_data: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session)
):
    """Register a new user with email verification"""
    try:
        # Check if username already exists
        existing_user = await db.execute(
            select(DBUser).where(DBUser.username == signup_data.username)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"username": "Username already exists"}
            )
        
        # Check if email already exists
        existing_email = await db.execute(
            select(DBUser).where(DBUser.email == signup_data.email)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"email": "Email already registered"}
            )
        
        # Create user (inactive until email verified)
        new_user = await create_user(
            db=db,
            username=signup_data.username,
            email=signup_data.email,
            password=signup_data.password
        )
        
        # Mark user as inactive until email verified
        new_user.is_active = False
        await db.commit()
        
        # Generate verification token
        verification_token = secrets.token_urlsafe(32)
        email_verification_tokens[verification_token] = {
            "user_id": str(new_user.id),
            "email": new_user.email,
            "created_at": datetime.utcnow()
        }
        
        # Send verification email in background
        background_tasks.add_task(send_verification_email, new_user.email, verification_token)
        
        return SignupResponse(
            success=True,
            message="Account created successfully. Please check your email to verify your account.",
            user_id=str(new_user.id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create account"
        )

@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_session)
):
    """Verify email address using token"""
    # For better UX, redirect to frontend with the token
    frontend_url = "http://localhost:3001"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"{frontend_url}/verify-email?token={token}")

@router.get("/verify-email-api")
async def verify_email_api(
    token: str,
    db: AsyncSession = Depends(get_session)
):
    """API endpoint to verify email address using token"""
    # Check if token exists
    if token not in email_verification_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    token_data = email_verification_tokens[token]
    
    # Check if token is expired (24 hours)
    token_age = datetime.utcnow() - token_data["created_at"]
    if token_age.total_seconds() > 86400:  # 24 hours
        del email_verification_tokens[token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired"
        )
    
    # Activate user
    user_id = uuid.UUID(token_data["user_id"])
    user = await db.execute(select(DBUser).where(DBUser.id == user_id))
    user = user.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_active = True
    await db.commit()
    
    # Remove used token
    del email_verification_tokens[token]
    
    return {
        "success": True,
        "message": "Email verified successfully. You can now log in."
    }

@router.post("/resend-verification")
async def resend_verification(
    email: EmailStr,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session)
):
    """Resend verification email"""
    # Find user by email
    user = await db.execute(select(DBUser).where(DBUser.email == email))
    user = user.scalar_one_or_none()
    
    if not user:
        # Don't reveal if email exists or not
        return {"message": "If an account exists with this email, a verification link will be sent."}
    
    if user.is_active:
        return {"message": "Account is already verified."}
    
    # Generate new verification token
    verification_token = secrets.token_urlsafe(32)
    email_verification_tokens[verification_token] = {
        "user_id": str(user.id),
        "email": user.email,
        "created_at": datetime.utcnow()
    }
    
    # Send verification email in background
    background_tasks.add_task(send_verification_email, user.email, verification_token)
    
    return {"message": "If an account exists with this email, a verification link will be sent."}

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = "http://localhost:8000/api/v1/auth/google/callback"

@router.get("/google")
async def google_login():
    """Redirect to Google OAuth"""
    # Check if OAuth is configured
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == "your-google-client-id":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Google OAuth not configured",
                "message": "Google OAuth is not properly configured. Please follow the setup guide.",
                "setup_guide": "/docs/GOOGLE_OAUTH_SETUP.md"
            }
        )
    
    # In production, use proper OAuth library like authlib
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline&"
        f"prompt=select_account"
    )
    return {"redirect_url": google_auth_url}

@router.get("/google/callback")
async def google_callback(
    code: str,
    db: AsyncSession = Depends(get_session)
):
    """Handle Google OAuth callback"""
    try:
        # Exchange code for token (simplified - use proper OAuth library in production)
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Exchange authorization code for access token
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange authorization code"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            # Get user info from Google
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user information from Google"
                )
            
            google_user = user_response.json()
            email = google_user.get("email")
            google_id = google_user.get("id")
            
            # Check if user exists
            existing_user = await db.execute(
                select(DBUser).where(DBUser.email == email)
            )
            user = existing_user.scalar_one_or_none()
            
            if not user:
                # Create new user
                username = email.split("@")[0]
                # Ensure unique username
                base_username = username
                counter = 1
                while True:
                    existing_username = await db.execute(
                        select(DBUser).where(DBUser.username == username)
                    )
                    if not existing_username.scalar_one_or_none():
                        break
                    username = f"{base_username}{counter}"
                    counter += 1
                
                # Create user with Google account (no password needed)
                user = DBUser(
                    username=username,
                    email=email,
                    hashed_password=f"google_{google_id}",  # Placeholder for Google users
                    is_active=True  # Google users are pre-verified
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
            
            # Create access token for the user
            access_token = create_access_token(
                subject=user.username,
                expires_delta=timedelta(minutes=30)
            )
            
            # Redirect to frontend with token
            frontend_url = "http://localhost:3001"
            return {
                "redirect_url": f"{frontend_url}/login?token={access_token}&type=google"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )