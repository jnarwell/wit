#!/usr/bin/env python3
"""
Check the exact authentication flow in the API
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🔍 Checking Authentication Flow")
print("=" * 50)

# First, let's see what's in the auth router
print("\n1️⃣ Checking auth router implementation...")
try:
    # Look at the auth router file
    auth_file = "routers/auth_router.py"
    if os.path.exists(auth_file):
        with open(auth_file, 'r') as f:
            content = f.read()
        
        # Find the login endpoint
        if '@router.post("/token")' in content:
            print("✅ Found /token endpoint")
            
            # Check what it's doing
            import re
            # Look for authenticate function
            if 'authenticate' in content:
                print("✅ Uses authenticate function")
            
            # Check if it's using the database
            if 'get_session' in content or 'db:' in content:
                print("✅ Uses database session")
            else:
                print("⚠️  Might not be using database properly")
                
        # Check if there's a mock/demo mode
        if 'demo' in content.lower() or 'mock' in content.lower():
            print("⚠️  Found demo/mock code - might be bypassing real auth")
            
            # Find demo credentials
            demo_match = re.search(r'username.*?["\'](\w+)["\'].*?password.*?["\'](\w+)["\']', content, re.IGNORECASE | re.DOTALL)
            if demo_match:
                print(f"   Demo credentials: {demo_match.group(1)} / {demo_match.group(2)}")
    else:
        print(f"❌ Auth router file not found at {auth_file}")
        
except Exception as e:
    print(f"❌ Error checking auth router: {e}")

# Check auth dependencies
print("\n2️⃣ Checking auth dependencies...")
try:
    deps_file = "auth/dependencies.py"
    if os.path.exists(deps_file):
        with open(deps_file, 'r') as f:
            content = f.read()
            
        if 'demo' in content or 'mock' in content:
            print("⚠️  Auth dependencies might have demo mode")
            
        if 'verify_password' in content:
            print("✅ Uses password verification")
            
    else:
        print(f"❌ Auth dependencies not found at {deps_file}")
        
except Exception as e:
    print(f"❌ Error checking dependencies: {e}")

# Check the actual login function
print("\n3️⃣ Testing the actual login flow...")
try:
    from routers.auth_router import router
    
    # Find the login endpoint
    for route in router.routes:
        if hasattr(route, 'path') and route.path == "/token":
            print(f"✅ Found token endpoint: {route.methods}")
            
            # Get the endpoint function
            endpoint = route.endpoint
            
            # Check if it's async
            import inspect
            if inspect.iscoroutinefunction(endpoint):
                print("✅ Endpoint is async")
                
            # Check parameters
            sig = inspect.signature(endpoint)
            print(f"   Parameters: {list(sig.parameters.keys())}")
            
except Exception as e:
    print(f"❌ Error inspecting login endpoint: {e}")

# Direct test
print("\n4️⃣ Direct authentication test...")
try:
    import asyncio
    from fastapi.security import OAuth2PasswordRequestForm
    
    # Create mock form
    class MockForm:
        username = "admin"
        password = "admin123"
        grant_type = "password"
        scopes = []
        client_id = None
        client_secret = None
    
    async def test_login():
        try:
            # Import login function
            from routers.auth_router import login
            
            # Create form
            form = MockForm()
            
            # Try to call login directly
            print("   Calling login function directly...")
            result = await login(form_data=form)
            
            print(f"   ✅ Login result: {result}")
            
        except Exception as e:
            print(f"   ❌ Direct login failed: {e}")
            
            # Try alternate approach
            try:
                from services.auth_services import AuthService
                from services.database_services import db_service
                
                auth_service = AuthService(db_service)
                user = await auth_service.authenticate_user("admin", "admin123")
                
                if user:
                    print(f"   ✅ Auth service authenticated user: {user}")
                else:
                    print(f"   ❌ Auth service failed to authenticate")
                    
            except Exception as e2:
                print(f"   ❌ Auth service error: {e2}")
    
    asyncio.run(test_login())
    
except Exception as e:
    print(f"❌ Direct test error: {e}")

print("\n" + "=" * 50)
print("💡 Findings and recommendations above")