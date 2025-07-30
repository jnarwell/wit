#!/usr/bin/env python3
"""
Test OAuth Redirect URI Configuration
"""
import webbrowser
from urllib.parse import quote

# Your client ID
CLIENT_ID = "54902465207-h74ibu5q2qd8pmebn4a8iae4f7vrma6d.apps.googleusercontent.com"

# Test different redirect URIs
redirect_uris = [
    "http://localhost:8000/api/v1/auth/google/callback",
    "http://localhost:3000/api/v1/auth/google/callback",
    "https://localhost:8000/api/v1/auth/google/callback",
]

print("=== OAuth Redirect URI Tester ===\n")
print("This will help identify which redirect URI is registered in Google Cloud Console\n")

for i, uri in enumerate(redirect_uris, 1):
    encoded_uri = quote(uri, safe='')
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={CLIENT_ID}&redirect_uri={encoded_uri}&response_type=code&scope=openid%20email%20profile&state=test{i}"
    
    print(f"{i}. Testing redirect URI: {uri}")
    print(f"   Auth URL: {auth_url[:100]}...")
    print(f"   → Open this in browser to test\n")

print("\nThe redirect URI that doesn't give an error is the one registered in Google Cloud Console.")
print("\nIMPORTANT: In Google Cloud Console, make sure you have EXACTLY this URI:")
print("http://localhost:8000/api/v1/auth/google/callback")
print("\nCommon mistakes:")
print("- Using https instead of http")
print("- Missing the port number")
print("- Having a trailing slash")
print("- Wrong path (/auth/google/callback vs /api/v1/auth/google/callback)")