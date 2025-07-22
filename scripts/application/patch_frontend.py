#!/usr/bin/env python3
"""
Corrected Frontend Patch Script - Properly fixes testConnection
"""

import os
import re
import shutil
from pathlib import Path
from datetime import datetime

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def find_test_connection_section(content):
    """Find the entire testConnection function including the simulated part"""
    # Look for the testConnection function start
    pattern = r'const testConnection = async \(\) => \{'
    match = re.search(pattern, content)
    
    if not match:
        return None, None
    
    start = match.start()
    
    # Find the end by counting braces
    brace_count = 0
    i = match.end() - 1  # Start from the opening brace
    
    while i < len(content):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                # Found the end, include the semicolon
                end = i + 1
                if i + 1 < len(content) and content[i + 1] == ';':
                    end = i + 2
                return start, end
        i += 1
    
    return None, None

def patch_machines_page_correctly():
    """Properly patch the MachinesPage.tsx file"""
    
    # Find the file
    machines_page_path = Path("software/frontend/web/src/pages/MachinesPage.tsx")
    
    if not machines_page_path.exists():
        print(f"{Colors.RED}❌ Could not find MachinesPage.tsx{Colors.END}")
        return False
    
    # Create backup
    backup_path = machines_page_path.with_suffix('.tsx.backup')
    shutil.copy(machines_page_path, backup_path)
    print(f"{Colors.GREEN}✅ Created backup: {backup_path}{Colors.END}")
    
    # Read the file
    with open(machines_page_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # The COMPLETE replacement for testConnection that actually calls the backend
    BACKEND_TEST_CONNECTION = '''const testConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      // Build request for backend API
      const requestBody: any = {
        connection_type: newMachine.connectionType.replace('network-', ''),
      };

      if (newMachine.connectionType === 'network-prusalink') {
        requestBody.url = newMachine.connectionDetails.replace(/^https?:\/\//, '').replace(/\/$/, '');
        requestBody.username = newMachine.username || 'maker';
        requestBody.password = newMachine.password;
        
        if (!requestBody.password) {
          setConnectionTestResult({ 
            success: false, 
            message: 'Password is required for PrusaLink' 
          });
          return;
        }
      } else if (newMachine.connectionType === 'network-octoprint') {
        requestBody.url = newMachine.connectionDetails;
        requestBody.api_key = newMachine.apiKey;
        
        if (!requestBody.api_key) {
          setConnectionTestResult({ 
            success: false, 
            message: 'API key is required for OctoPrint' 
          });
          return;
        }
      } else {
        requestBody.port = newMachine.connectionDetails;
      }

      // Actually call the backend
      const response = await fetch('/api/v1/equipment/printers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const result = await response.json();
      setConnectionTestResult({ 
        success: result.success, 
        message: result.message 
      });
      
    } catch (error: any) {
      console.error('Connection test error:', error);
      setConnectionTestResult({ 
        success: false, 
        message: 'Could not reach backend. Is dev_server.py running?' 
      });
    } finally {
      setTestingConnection(false);
    }
  };'''

    # Find and replace the entire testConnection function
    print(f"\n{Colors.BLUE}Finding testConnection function...{Colors.END}")
    start, end = find_test_connection_section(content)
    
    if start is not None and end is not None:
        # Check if it's the simulated version
        function_content = content[start:end]
        if "Backend API not yet implemented" in function_content or "Simulate connection test locally" in function_content:
            print(f"{Colors.YELLOW}Found simulated testConnection - replacing with backend version{Colors.END}")
            content = content[:start] + BACKEND_TEST_CONNECTION + content[end:]
            print(f"{Colors.GREEN}✅ Replaced testConnection with backend-calling version{Colors.END}")
        else:
            print(f"{Colors.YELLOW}testConnection appears to already call backend{Colors.END}")
    else:
        print(f"{Colors.RED}❌ Could not find testConnection function{Colors.END}")
        return False
    
    # Also fix handleAddMachine to ensure it sends the right format
    # Look for the specific part that needs fixing
    add_machine_fix = '''
      // Prepare request for backend with correct format
      const backendRequest: any = {
        printer_id: machineId,
        name: newMachine.name || typeConfig.defaultName,
        connection_type: newMachine.connectionType.replace('network-', ''), // Fix: remove 'network-' prefix
        manufacturer: newMachine.manufacturer,
        model: newMachine.model,
        auto_connect: true
      };

      // Add connection-specific fields
      if (newMachine.connectionType === 'network-prusalink') {
        backendRequest.url = newMachine.connectionDetails.replace(/^https?:\/\//, '').replace(/\/$/, '');
        backendRequest.username = newMachine.username || 'maker';
        backendRequest.password = newMachine.password;
      } else if (newMachine.connectionType === 'network-octoprint') {
        backendRequest.url = newMachine.connectionDetails;
        backendRequest.api_key = newMachine.apiKey;
      }'''
    
    # Fix the POST request body format in handleAddMachine
    if 'connection_type: newMachine.connectionType.replace' not in content:
        print(f"\n{Colors.BLUE}Fixing handleAddMachine connection type...{Colors.END}")
        
        # Find the POST request in handleAddMachine
        post_pattern = r'const response = await fetch\(\'/api/v1/equipment/printers\',[\s\S]*?body: JSON\.stringify\(\{[\s\S]*?\}\)'
        post_match = re.search(post_pattern, content)
        
        if post_match:
            old_post = post_match.group(0)
            # Check if it needs fixing
            if 'connection_type: newMachine.connectionType,' in old_post or 'connection_type: backendConnectionType' not in old_post:
                # Replace with corrected version
                new_post = '''const response = await fetch('/api/v1/equipment/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer_id: machineId,
          name: newMachine.name || typeConfig.defaultName,
          connection_type: newMachine.connectionType.replace('network-', ''),
          url: newMachine.connectionType === 'network-prusalink' 
            ? newMachine.connectionDetails.replace(/^https?:\/\//, '').replace(/\/$/, '')
            : newMachine.connectionType === 'network-octoprint'
            ? newMachine.connectionDetails
            : undefined,
          username: newMachine.connectionType === 'network-prusalink' ? newMachine.username : undefined,
          password: newMachine.connectionType === 'network-prusalink' ? newMachine.password : undefined,
          api_key: newMachine.connectionType === 'network-octoprint' ? newMachine.apiKey : undefined,
          manufacturer: newMachine.manufacturer,
          model: newMachine.model,
          auto_connect: true
        })'''
                
                content = content.replace(old_post, new_post)
                print(f"{Colors.GREEN}✅ Fixed handleAddMachine POST body format{Colors.END}")
    
    # Write the patched content
    with open(machines_page_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n{Colors.GREEN}✅ Successfully patched MachinesPage.tsx{Colors.END}")
    return True

def main():
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}W.I.T. Frontend Patch Script (Corrected){Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    if not Path("software/frontend/web").exists():
        print(f"\n{Colors.RED}❌ Error: Not in project root directory{Colors.END}")
        return
    
    if patch_machines_page_correctly():
        print(f"\n{Colors.GREEN}✅ Patching complete!{Colors.END}")
        print(f"\n{Colors.BLUE}The patch fixed:{Colors.END}")
        print(f"1. ✅ testConnection now calls the backend API")
        print(f"2. ✅ Connection type is properly formatted (removes 'network-' prefix)")
        print(f"3. ✅ URL is cleaned (removes http:// and trailing slashes)")
        print(f"4. ✅ POST body format matches backend expectations")
        
        print(f"\n{Colors.BLUE}Next steps:{Colors.END}")
        print(f"1. Make sure backend is running on port 8000")
        print(f"2. Restart the frontend: cd software/frontend/web && npm run dev")
        print(f"3. Test adding a machine - it should work now!")
    else:
        print(f"\n{Colors.RED}❌ Patching failed{Colors.END}")

if __name__ == "__main__":
    main()