// Fresh main.tsx with overflow prevention built-in

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Ensure clean DOM before React mounts
function setupDOM() {
  // Clear any existing content
  document.body.innerHTML = '';
  
  // Apply overflow prevention styles
  document.documentElement.style.cssText = `
    margin: 0 !important;
    padding: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden !important;
    overflow: clip !important;
  `;
  
  document.body.style.cssText = `
    margin: 0 !important;
    padding: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden !important;
    overflow: clip !important;
    position: relative !important;
  `;
  
  // Create root element
  const root = document.createElement('div');
  root.id = 'root';
  root.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden !important;
    background: white !important;
  `;
  
  document.body.appendChild(root);
  
  return root;
}

// Setup DOM
const rootElement = setupDOM();

// Create React root
const root = ReactDOM.createRoot(rootElement);

// Render app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Continuous overflow prevention
function enforceOverflowPrevention() {
  // Hide any elements added by extensions
  const bodyChildren = Array.from(document.body.children);
  bodyChildren.forEach(child => {
    if (child.id !== 'root' && 
        child.tagName !== 'SCRIPT' && 
        child.tagName !== 'NOSCRIPT') {
      (child as HTMLElement).style.cssText = 
        'display: none !important; position: absolute !important; left: -99999px !important; width: 0 !important; height: 0 !important;';
    }
  });
  
  // Check for overflow
  if (document.documentElement.scrollWidth > window.innerWidth) {
    console.warn('Overflow detected, applying fix...');
    document.documentElement.style.overflowX = 'clip';
    document.body.style.overflowX = 'clip';
  }
}

// Run enforcement
enforceOverflowPrevention();

// Set up continuous enforcement
setInterval(enforceOverflowPrevention, 500);

// Monitor DOM changes
const observer = new MutationObserver(enforceOverflowPrevention);
observer.observe(document.body, { 
  childList: true, 
  subtree: false 
});

// Log success
console.log('✅ W.I.T. Terminal initialized with overflow prevention');

// Development helpers
if (import.meta.env.DEV) {
  // Log viewport info
  console.log('Viewport:', window.innerWidth, 'x', window.innerHeight);
  
  // Check for overflow on resize
  window.addEventListener('resize', () => {
    const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
    if (hasOverflow) {
      console.error('Overflow detected on resize!');
      enforceOverflowPrevention();
    }
  });
}