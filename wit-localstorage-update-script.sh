#!/bin/bash
# W.I.T. localStorage Update Script for SensorsPage and ProjectsPage
# Based on the improved pattern from MachinesPage

echo "🔧 W.I.T. localStorage Persistence Update Script"
echo "=============================================="
echo "This script updates SensorsPage.tsx and ProjectsPage.tsx to use the improved"
echo "localStorage pattern that prevents data loss on navigation."
echo ""

# Check if we're in the right directory
if [ ! -d "software/frontend/web/src/pages" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    exit 1
fi

# Backup the original files
echo "📦 Creating backups..."
cp software/frontend/web/src/pages/SensorsPage.tsx software/frontend/web/src/pages/SensorsPage.tsx.backup
cp software/frontend/web/src/pages/ProjectsPage.tsx software/frontend/web/src/pages/ProjectsPage.tsx.backup
echo "✅ Backups created with .backup extension"

# Function to apply the localStorage fix
apply_localstorage_fix() {
    local file=$1
    local entity=$2  # "sensor" or "project"
    local Entity=$3  # "Sensor" or "Project"
    local ENTITY=$4  # "SENSOR" or "PROJECT"
    local storage_key=$5  # "wit-sensors" or "wit-projects"
    
    echo ""
    echo "🔄 Updating $file..."
    
    # Create a temporary file for the updated content
    local temp_file="${file}.tmp"
    
    # Read the file and apply transformations
    python3 << EOF
import re

with open('$file', 'r') as f:
    content = f.read()

# Step 1: Update the state initialization to use lazy loading
# Find the useState declaration
old_pattern = r'const \[${entity}s, set${Entity}s\] = useState<${Entity}\[\]>\(\[\]\);'
new_init = '''const [${entity}s, set${Entity}s] = useState<${Entity}[]>(() => {
    // Initialize from localStorage to prevent race condition
    const saved = localStorage.getItem('${storage_key}');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('[${Entity}sPage] Initial state from localStorage:', parsed.length, '${entity}s');
        return parsed;
      } catch (e) {
        console.error('[${Entity}sPage] Failed to parse initial state:', e);
        return [];
      }
    }
    console.log('[${Entity}sPage] No saved ${entity}s, starting with empty array');
    return [];
  });'''

content = re.sub(old_pattern, new_init, content)

# Step 2: Add debug useEffect after state initialization
# Find where to insert the debug effect (after other state declarations)
insert_pattern = r'(const \[can.*?Navigate.*?\] = useState.*?;)'
debug_effect = '''

  // Debug: Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('${storage_key}');
    console.log('[${Entity}sPage] Component mounted. localStorage:', stored ? 'has data' : 'empty');
  }, []); // Run once to check initial state'''

if not re.search(r'Component mounted\. localStorage:', content):
    content = re.sub(insert_pattern, r'\1' + debug_effect, content)

# Step 3: Remove the old load effect
# Find and remove the useEffect that loads from localStorage
load_pattern = r'// Load saved .*? on mount\s*useEffect\(\(\) => \{[\s\S]*?localStorage\.removeItem.*?\}\s*\}\s*\}, \[\]\);'
content = re.sub(load_pattern, '', content)

# Alternative pattern if comment is different
load_pattern2 = r'useEffect\(\(\) => \{\s*const saved = localStorage\.getItem\([\'"]${storage_key}[\'"]\);[\s\S]*?\}\s*\}, \[\]\);'
content = re.sub(load_pattern2, '', content)

# Step 4: Update the save effect
# Find the save effect
save_pattern = r'// Save .*? to localStorage whenever.*?\s*useEffect\(\(\) => \{\s*localStorage\.setItem\([\'"]${storage_key}[\'"]\], JSON\.stringify\(${entity}s\)\);\s*\}, \[${entity}s\]\);'

new_save_effect = '''// Save ${entity}s to localStorage whenever they change
  useEffect(() => {
    console.log('[${Entity}sPage] Saving', ${entity}s.length, '${entity}s to localStorage');
    localStorage.setItem('${storage_key}', JSON.stringify(${entity}s));
    
    // Verify it saved
    const saved = localStorage.getItem('${storage_key}');
    console.log('[${Entity}sPage] Verified save:', saved ? JSON.parse(saved).length + ' ${entity}s' : 'null');
  }, [${entity}s]);'''

content = re.sub(save_pattern, new_save_effect, content)

# Write the updated content
with open('$temp_file', 'w') as f:
    f.write(content)
EOF

    # Replace the original file with the updated one
    mv "$temp_file" "$file"
    echo "✅ Updated $file"
}

# Apply fixes to SensorsPage.tsx
apply_localstorage_fix \
    "software/frontend/web/src/pages/SensorsPage.tsx" \
    "sensor" \
    "Sensor" \
    "SENSOR" \
    "wit-sensors"

# Apply fixes to ProjectsPage.tsx
apply_localstorage_fix \
    "software/frontend/web/src/pages/ProjectsPage.tsx" \
    "project" \
    "Project" \
    "PROJECT" \
    "wit-projects"

echo ""
echo "🎉 localStorage updates complete!"
echo ""
echo "📋 Summary of changes:"
echo "  1. ✅ State initialization now uses lazy loading from localStorage"
echo "  2. ✅ Added debug logging to track localStorage operations"
echo "  3. ✅ Removed redundant load effects"
echo "  4. ✅ Enhanced save effects with verification"
echo ""
echo "🔍 To verify the changes:"
echo "  1. Check the updated files in your editor"
echo "  2. Run the app and add some sensors/projects"
echo "  3. Navigate away and back - data should persist"
echo "  4. Check browser console for debug messages"
echo ""
echo "↩️  To restore original files:"
echo "  mv software/frontend/web/src/pages/SensorsPage.tsx.backup software/frontend/web/src/pages/SensorsPage.tsx"
echo "  mv software/frontend/web/src/pages/ProjectsPage.tsx.backup software/frontend/web/src/pages/ProjectsPage.tsx"
echo ""
echo "📝 Note: This update follows the pattern successfully implemented in MachinesPage.tsx"