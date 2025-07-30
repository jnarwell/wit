#!/usr/bin/env python3
"""
Check OAuth Configuration
Helps diagnose and fix OAuth redirect URI issues
"""
import os
import sys

def check_oauth_config():
    print("=== OAuth Configuration Check ===\n")
    
    # Check Google OAuth settings
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback")
    
    print("Current Configuration:")
    print(f"GOOGLE_CLIENT_ID: {client_id[:20]}..." if client_id else "GOOGLE_CLIENT_ID: Not set")
    print(f"GOOGLE_REDIRECT_URI: {redirect_uri}")
    
    print("\n" + "="*50 + "\n")
    print("To fix the redirect_uri_mismatch error:")
    print("\n1. Add this EXACT redirect URI to your Google Cloud Console:")
    print(f"   {redirect_uri}")
    
    print("\n2. In Google Cloud Console:")
    print("   - Go to APIs & Services > Credentials")
    print("   - Click on your OAuth 2.0 Client ID")
    print("   - Under 'Authorized redirect URIs', add:")
    print(f"     {redirect_uri}")
    print("   - Click 'Save'")
    
    print("\n3. Common redirect URIs to add:")
    print("   - http://localhost:8000/api/v1/auth/google/callback")
    print("   - http://localhost:3000/api/v1/auth/google/callback")
    print("   - http://localhost:3001/api/v1/auth/google/callback")
    
    print("\n4. If you're using a different port, set GOOGLE_REDIRECT_URI:")
    print("   export GOOGLE_REDIRECT_URI='http://localhost:YOUR_PORT/api/v1/auth/google/callback'")
    
    print("\n" + "="*50 + "\n")
    
    # Check if running through frontend proxy
    if "3000" in redirect_uri or "3001" in redirect_uri:
        print("⚠️  Frontend Proxy Detected!")
        print("Make sure your frontend is proxying /api requests to the backend on port 8000")
    
    return redirect_uri

if __name__ == "__main__":
    redirect_uri = check_oauth_config()
    
    # Test URL generation
    print("\nTest OAuth URL:")
    print(f"https://accounts.google.com/o/oauth2/v2/auth?client_id={os.getenv('GOOGLE_CLIENT_ID', 'YOUR_CLIENT_ID')}&redirect_uri={redirect_uri}&response_type=code&scope=openid+email+profile&state=test123")