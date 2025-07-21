#!/usr/bin/env python3
"""
Analyze main.py and dev_server.py to help reconcile them

File: software/backend/analyze_servers.py
"""

import ast
import re
import os

def analyze_file(filename):
    """Analyze a Python file to extract key information"""
    if not os.path.exists(filename):
        return None
    
    with open(filename, 'r') as f:
        content = f.read()
    
    # Parse the AST
    try:
        tree = ast.parse(content)
    except:
        print(f"Error parsing {filename}")
        return None
    
    analysis = {
        'imports': [],
        'routers': [],
        'app_creation': None,
        'startup_events': [],
        'endpoints': [],
        'middleware': [],
        'services': [],
        'auth': [],
        'port': None,
        'host': None
    }
    
    # Extract imports
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                analysis['imports'].append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ''
            for alias in node.names:
                analysis['imports'].append(f"{module}.{alias.name}")
    
    # Find FastAPI app creation
    app_pattern = r'(\w+)\s*=\s*FastAPI\s*\('
    app_match = re.search(app_pattern, content)
    if app_match:
        analysis['app_creation'] = app_match.group(1)
    
    # Find router includes
    router_pattern = r'(\w+)\.include_router\s*\(([^)]+)\)'
    for match in re.finditer(router_pattern, content):
        analysis['routers'].append(match.group(2).strip())
    
    # Find endpoints
    endpoint_pattern = r'@(\w+)\.(get|post|put|delete|patch)\s*\(["\']([^"\']+)'
    for match in re.finditer(endpoint_pattern, content):
        analysis['endpoints'].append({
            'method': match.group(2),
            'path': match.group(3)
        })
    
    # Find startup events
    startup_pattern = r'@(\w+)\.on_event\s*\(["\']startup'
    if re.search(startup_pattern, content):
        analysis['startup_events'].append('Found startup event')
    
    # Find lifespan context manager
    if 'lifespan' in content:
        analysis['startup_events'].append('Uses lifespan context manager')
    
    # Find auth related
    auth_keywords = ['auth', 'login', 'jwt', 'token', 'authenticate']
    for keyword in auth_keywords:
        if keyword.lower() in content.lower():
            analysis['auth'].append(keyword)
    
    # Find port/host configuration
    port_pattern = r'port\s*=\s*(\d+)'
    host_pattern = r'host\s*=\s*["\']([^"\']+)'
    
    port_match = re.search(port_pattern, content)
    if port_match:
        analysis['port'] = port_match.group(1)
    
    host_match = re.search(host_pattern, content)
    if host_match:
        analysis['host'] = host_match.group(1)
    
    # Find services
    service_keywords = ['equipment', 'voice', 'vision', 'mqtt', 'redis', 'database']
    for keyword in service_keywords:
        if keyword in content.lower():
            analysis['services'].append(keyword)
    
    return analysis

def compare_files():
    """Compare main.py and dev_server.py"""
    print("=== Server Files Analysis ===\n")
    
    # Analyze both files
    main_analysis = analyze_file('main.py')
    dev_analysis = analyze_file('dev_server.py')
    
    if not main_analysis:
        print("❌ Could not analyze main.py")
        return
    
    if not dev_analysis:
        print("❌ Could not find/analyze dev_server.py")
        print("\nOnly main.py exists. You should run:")
        print("  python main.py")
        return
    
    # Compare findings
    print("📄 MAIN.PY:")
    print(f"  - FastAPI app variable: {main_analysis['app_creation']}")
    print(f"  - Number of routers: {len(main_analysis['routers'])}")
    print(f"  - Direct endpoints: {len(main_analysis['endpoints'])}")
    print(f"  - Has startup events: {bool(main_analysis['startup_events'])}")
    print(f"  - Services: {', '.join(main_analysis['services']) or 'None detected'}")
    print(f"  - Auth features: {', '.join(set(main_analysis['auth'])) or 'None detected'}")
    
    print("\n📄 DEV_SERVER.PY:")
    print(f"  - FastAPI app variable: {dev_analysis['app_creation']}")
    print(f"  - Number of routers: {len(dev_analysis['routers'])}")
    print(f"  - Direct endpoints: {len(dev_analysis['endpoints'])}")
    print(f"  - Has startup events: {bool(dev_analysis['startup_events'])}")
    print(f"  - Services: {', '.join(dev_analysis['services']) or 'None detected'}")
    print(f"  - Auth features: {', '.join(set(dev_analysis['auth'])) or 'None detected'}")
    print(f"  - Port: {dev_analysis['port'] or 'Default (8000)'}")
    
    # Detailed router comparison
    print("\n🔌 ROUTERS:")
    print("  main.py routers:")
    for router in main_analysis['routers'][:10]:  # Show first 10
        print(f"    - {router}")
    if len(main_analysis['routers']) > 10:
        print(f"    ... and {len(main_analysis['routers']) - 10} more")
    
    print("\n  dev_server.py routers:")
    for router in dev_analysis['routers'][:10]:  # Show first 10
        print(f"    - {router}")
    if len(dev_analysis['routers']) > 10:
        print(f"    ... and {len(dev_analysis['routers']) - 10} more")
    
    # Find differences
    main_only_routers = set(main_analysis['routers']) - set(dev_analysis['routers'])
    dev_only_routers = set(dev_analysis['routers']) - set(main_analysis['routers'])
    
    if main_only_routers:
        print(f"\n  ⚠️  Routers only in main.py: {len(main_only_routers)}")
        for router in list(main_only_routers)[:5]:
            print(f"    - {router}")
    
    if dev_only_routers:
        print(f"\n  ⚠️  Routers only in dev_server.py: {len(dev_only_routers)}")
        for router in list(dev_only_routers)[:5]:
            print(f"    - {router}")
    
    # Recommendations
    print("\n📋 RECOMMENDATIONS:")
    
    if len(dev_analysis['endpoints']) > len(main_analysis['endpoints']):
        print("  1. dev_server.py has more endpoints - it might be the active development file")
        print("     Consider merging main.py routers into dev_server.py")
    else:
        print("  1. main.py seems more complete with routers")
        print("     Consider using main.py as the primary server file")
    
    if main_only_routers:
        print(f"\n  2. Add these routers from main.py to dev_server.py:")
        print("     # Add to imports section:")
        print("     from routers import projects, tasks, teams, materials, files")
        print("\n     # Add after app creation:")
        for router in list(main_only_routers)[:5]:
            print(f"     app.include_router({router})")
    
    print("\n  3. To merge the files:")
    print("     - Use dev_server.py as base (since it's currently running)")
    print("     - Add the missing router imports from main.py")
    print("     - Add the missing include_router calls")
    print("     - Test all endpoints")
    
    print("\n  4. Quick fix - add to dev_server.py:")
    print("""
# Add these imports at the top:
from routers import projects, tasks, teams, materials, files

# Find where other routers are included and add:
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(teams.router)
app.include_router(materials.router)
app.include_router(files.router)
""")
    
    # Check which file to run
    print("\n🚀 TO RUN THE SERVER:")
    if os.path.exists('.env'):
        print("  With current setup, run:")
        print("  python dev_server.py  # (currently running)")
        print("\n  Or switch to main.py:")
        print("  python main.py  # (has project routers)")
    
    # Generate merge script
    print("\n💡 To generate a merge script, run:")
    print("  python analyze_servers.py > merge_plan.txt")
    print("  Then review and implement the changes")

if __name__ == "__main__":
    compare_files()