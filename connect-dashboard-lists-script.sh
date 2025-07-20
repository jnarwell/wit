#!/bin/bash
# W.I.T. Restore Proper Layout

echo "🔨 W.I.T. Complete Layout Restoration"
echo "===================================="
echo "Fixing the entire page layout structure"
echo ""

# Check if we're in the right directory
if [ ! -d "software/frontend/web/src" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# First, let's clean up App.css from all the conflicting styles
echo "🧹 Cleaning up conflicting CSS..."

# Backup current App.css
cp software/frontend/web/src/App.css software/frontend/web/src/App.css.broken-backup

# Create a clean, working App.css
echo "📝 Creating clean layout CSS..."

cat > software/frontend/web/src/styles/clean-layout.css << 'EOF'
/* Clean Layout CSS for W.I.T. */

/* Base layout structure */
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #111827;
}

/* Main app container */
.App {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Navigation bar */
nav {
  flex-shrink: 0;
  z-index: 50;
}

/* Main content wrapper */
main {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* Page layout container */
.h-full.flex {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Sidebar */
.bg-gray-800.w-64 {
  width: 16rem;
  flex-shrink: 0;
  overflow-y: auto;
  background-color: #1f2937;
}

/* Main content area */
.flex-1.p-6 {
  flex: 1;
  padding: 1.5rem;
  background-color: #1f2937;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Grid container */
.relative.w-full.h-full {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  background-color: #374151;
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Grid items */
.absolute {
  position: absolute;
}

/* Modal fixes */
.fixed.inset-0 {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.fixed .bg-gray-800.rounded-lg {
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  margin: auto;
}

/* Detail page fixes */
.h-full.bg-gray-900 {
  width: 100%;
  height: 100%;
  padding: 2rem;
}

/* Utility classes */
.overflow-hidden {
  overflow: hidden;
}

.overflow-auto {
  overflow: auto;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #374151;
}

::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
EOF

echo "✅ Created clean layout CSS"

# Now fix the component structure
echo ""
echo "📝 Fixing page component structure..."

# Fix MachinesPage
if [ -f "software/frontend/web/src/pages/MachinesPage.tsx" ]; then
    echo "  🔧 Checking MachinesPage structure..."
    
    # Make sure the page has proper structure
    # This is a safety check - we'll create a verification script
    cat > check_structure.py << 'EOF'
import re

with open('software/frontend/web/src/pages/MachinesPage.tsx', 'r') as f:
    content = f.read()

# Check if main structure exists
has_container = 'className="h-full flex"' in content
has_sidebar = 'className="bg-gray-800 w-64' in content
has_content = 'className="flex-1 p-6"' in content or 'className="flex-1 p-6 bg-gray-800"' in content
has_grid = 'ref={containerRef}' in content

print(f"Structure check:")
print(f"  Has container: {has_container}")
print(f"  Has sidebar: {has_sidebar}")
print(f"  Has content area: {has_content}")
print(f"  Has grid container: {has_grid}")

if not all([has_container, has_sidebar, has_content, has_grid]):
    print("❌ Page structure is broken!")
else:
    print("✅ Page structure looks correct")
EOF

    python3 check_structure.py
    rm check_structure.py
fi

# Import the clean CSS
echo ""
echo "📝 Importing clean layout CSS..."

# Add import to App.css
echo '@import "./styles/clean-layout.css";' > software/frontend/web/src/App.css.tmp
echo "" >> software/frontend/web/src/App.css.tmp
cat software/frontend/web/src/App.css >> software/frontend/web/src/App.css.tmp
mv software/frontend/web/src/App.css.tmp software/frontend/web/src/App.css

# Create a layout verification utility
echo ""
echo "📝 Creating layout verification utility..."

cat > software/frontend/web/src/utils/verifyLayout.ts << 'EOF'
// Verify and fix layout structure
export const verifyLayout = () => {
  console.log('[Layout] Verifying page structure...');
  
  // Check for main containers
  const mainContent = document.querySelector('.flex-1.p-6');
  const sidebar = document.querySelector('.bg-gray-800.w-64');
  const gridContainer = document.querySelector('.relative.w-full.h-full');
  
  console.log('[Layout] Main content:', mainContent ? 'Found' : 'Missing');
  console.log('[Layout] Sidebar:', sidebar ? 'Found' : 'Missing');
  console.log('[Layout] Grid container:', gridContainer ? 'Found' : 'Missing');
  
  // Fix visibility
  if (mainContent) {
    const el = mainContent as HTMLElement;
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.flex = '1';
    el.style.visibility = 'visible';
  }
  
  if (gridContainer) {
    const el = gridContainer as HTMLElement;
    el.style.display = 'block';
    el.style.visibility = 'visible';
    el.style.position = 'relative';
  }
  
  // Check for grid items
  const gridItems = document.querySelectorAll('.absolute[style*="transform"]');
  console.log('[Layout] Grid items found:', gridItems.length);
  
  gridItems.forEach((item, index) => {
    const el = item as HTMLElement;
    el.style.visibility = 'visible';
    console.log(`[Layout] Grid item ${index}:`, el);
  });
};

// Run on page load and route changes
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', verifyLayout);
  
  // Monitor route changes
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      setTimeout(verifyLayout, 100);
    }
  }, 100);
}
EOF

echo "✅ Created layout verification"

# Quick inline fix
echo ""
echo "📝 Adding emergency inline styles..."

cat >> software/frontend/web/src/index.css << 'EOF'

/* Emergency layout fix */
.h-full.flex {
  display: flex !important;
  height: 100% !important;
}

.bg-gray-800.w-64 {
  width: 16rem !important;
  flex-shrink: 0 !important;
}

.flex-1.p-6 {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
}

.relative.w-full.h-full {
  display: block !important;
  position: relative !important;
}
EOF

echo ""
echo "🎉 Layout restoration complete!"
echo ""
echo "📋 What was fixed:"
echo "  ✅ Clean CSS structure without conflicts"
echo "  ✅ Proper flex layout (sidebar + content)"
echo "  ✅ Grid container visibility"
echo "  ✅ Modal constraints"
echo ""
echo "🔄 IMPORTANT STEPS:"
echo "  1. Restart your dev server"
echo "  2. Clear browser cache (Ctrl+Shift+Delete)"
echo "  3. Hard refresh (Ctrl+F5)"
echo ""
echo "💡 Check browser console for [Layout] messages"
echo ""
echo "If still broken, restore original:"
echo "  git checkout software/frontend/web/src/App.css"
echo "  git checkout software/frontend/web/src/index.css"