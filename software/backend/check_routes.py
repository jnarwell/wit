#!/usr/bin/env python3
"""
Check all registered routes in the FastAPI application
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dev_server import app

print("🔍 Registered Routes in W.I.T. Backend")
print("=" * 50)

routes = []
for route in app.routes:
    if hasattr(route, "methods") and hasattr(route, "path"):
        for method in route.methods:
            routes.append((method, route.path, route.name))

# Sort by path
routes.sort(key=lambda x: x[1])

# Group by prefix
current_prefix = None
for method, path, name in routes:
    prefix = path.split('/')[1] if '/' in path[1:] else ''
    
    if prefix != current_prefix:
        print(f"\n📁 /{prefix}")
        current_prefix = prefix
        
    print(f"  {method:6} {path:50} [{name}]")

print("\n" + "=" * 50)
print(f"Total routes: {len(routes)}")

# Check for specific routes
print("\n🔍 Checking for expected routes:")
expected = [
    "/api/v1/projects",
    "/api/v1/tasks", 
    "/api/v1/teams",
    "/api/v1/auth/token"
]

for route in expected:
    found = any(path == route for _, path, _ in routes)
    if found:
        print(f"  ✓ {route}")
    else:
        print(f"  ✗ {route} NOT FOUND")