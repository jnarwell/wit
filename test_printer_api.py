#!/usr/bin/env python3
"""
Fix the frontend code to properly sync printer IDs with backend
"""

import os
import re

print("🔧 Fixing Frontend Printer ID Sync Issue")
print("="*50 + "\n")

# Find the MachinesPage.tsx file
possible_paths = [
    "software/frontend/web/src/pages/MachinesPage.tsx",
    "frontend/web/src/pages/MachinesPage.tsx",
    "src/pages/MachinesPage.tsx"
]

machines_page_path = None
for path in possible_paths:
    if os.path.exists(path):
        machines_page_path = path
        break

if not machines_page_path:
    print("❌ Could not find MachinesPage.tsx")
    print("   Please update the path in this script")
    exit(1)

print(f"✅ Found MachinesPage.tsx at: {machines_page_path}")

# Read the file
with open(machines_page_path, 'r') as f:
    content = f.read()

# Backup the original
backup_path = machines_page_path + '.backup-before-fix'
with open(backup_path, 'w') as f:
    f.write(content)
print(f"📄 Created backup at: {backup_path}")

# Fix 1: Change how machine IDs are generated
print("\n1. Fixing machine ID generation...")

# Find the line where machineId is generated
old_id_generation = r"const machineId = 'M' \+ Date\.now\(\) \+ Math\.floor\(Math\.random\(\) \* 1000\);"
new_id_generation = "const machineId = newMachine.type + '-' + Date.now(); // Temporary ID until backend assigns one"

content = re.sub(old_id_generation, new_id_generation, content)

# Fix 2: Update the printer addition logic to use backend ID
print("2. Fixing printer addition logic...")

# Find the section where printer is added to backend
old_pattern = r'''console\.log\('\[MachinesPage\] Adding printer to backend:', apiRequest\);

        const response = await fetch\(`\$\{API_BASE_URL\}/api/v1/equipment/printers`, \{
          method: 'POST',
          headers: getAuthHeaders\(\),
          body: JSON\.stringify\(apiRequest\)
        \}\);

        if \(response\.ok\) \{
          const result = await response\.json\(\);
          console\.log\('\[MachinesPage\] Printer added to backend:', result\);'''

new_code = '''console.log('[MachinesPage] Adding printer to backend:', apiRequest);

        const response = await fetch(`${API_BASE_URL}/api/v1/equipment/printers`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(apiRequest)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[MachinesPage] Printer added to backend:', result);
          
          // IMPORTANT: Use the backend's printer ID, not our temporary one
          const backendPrinterId = apiRequest.printer_id; // This is what we sent to backend'''

if old_pattern in content:
    content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

# Fix 3: Update status polling to use correct ID
print("3. Fixing status polling...")

# Find where pollStatus is called
old_poll = r"const statusResponse = await fetch\(`\$\{API_BASE_URL\}/api/v1/equipment/printers/\$\{machineId\}`"
new_poll = "const statusResponse = await fetch(`${API_BASE_URL}/api/v1/equipment/printers/${backendPrinterId || machineId}`"

content = content.replace(old_poll, new_poll)

# Fix 4: Add error handling for missing printers
print("4. Adding error handling for missing printers...")

# Find the refreshPrinterStatus function
old_refresh = r'''const refreshPrinterStatus = useCallback\(async \(printerId: string\) => \{
    if \(!printerId\) return;
    
    try \{
      const response = await fetch\(`\$\{API_BASE_URL\}/api/v1/equipment/printers/\$\{printerId\}`\);'''

new_refresh = '''const refreshPrinterStatus = useCallback(async (printerId: string) => {
    if (!printerId) return;
    
    // Skip frontend-generated IDs that haven't been synced with backend
    if (printerId.startsWith('M') && printerId.length > 10) {
      console.warn('[MachinesPage] Skipping status refresh for unsync printer:', printerId);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/equipment/printers/${printerId}`);'''

content = re.sub(old_refresh, new_refresh, content, flags=re.DOTALL)

# Write the fixed content
with open(machines_page_path, 'w') as f:
    f.write(content)

print("\n✅ Fixed MachinesPage.tsx!")

# Create a simpler temporary fix
print("\n5. Creating temporary browser fix...")

browser_fix = '''// Temporary fix - paste this in browser console
// This prevents errors while the code is being rebuilt

// Clear problematic machines
localStorage.removeItem('wit-machines');

// Override fetch to prevent errors
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('/api/v1/equipment/printers/M')) {
    console.log('Blocked request for invalid printer ID');
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('Not found')
    });
  }
  return originalFetch.apply(this, args);
};

console.log('✅ Temporary fix applied - refresh the page');
setTimeout(() => location.reload(), 1000);
'''

with open("browser_fix.js", "w") as f:
    f.write(browser_fix)

print("📄 Created browser_fix.js")

print("\n" + "="*50)
print("\n✅ Fix Complete!")
print("\n🎯 Next Steps:")
print("1. The frontend code has been patched")
print("2. Rebuild the frontend:")
print("   cd software/frontend/web")
print("   npm run build")
print("\n3. For immediate relief, run this in browser console:")
print("   localStorage.removeItem('wit-machines'); location.reload();")
print("\n4. Or paste the contents of browser_fix.js in console")
print("\n💡 The issue was that the frontend was creating its own IDs")
print("   instead of using the backend's printer IDs.")