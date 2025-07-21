// Temporary fix - paste this in browser console
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
