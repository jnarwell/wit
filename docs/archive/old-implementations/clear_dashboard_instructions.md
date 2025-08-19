# Clear Dashboard Widgets

To clear all widgets from your W.I.T. dashboard, follow these steps:

## Option 1: Using Browser Console (Recommended)

1. Open your W.I.T. application in the browser (http://localhost:3002)
2. Open the browser's Developer Console:
   - Chrome/Edge: Press F12 or Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (Mac)
   - Firefox: Press F12 or Ctrl+Shift+K (Windows/Linux) or Cmd+Option+K (Mac)
   - Safari: Press Cmd+Option+C (Mac)
3. In the console, paste and run these commands:

```javascript
// Clear all dashboard widgets
localStorage.setItem('clearDashboard', 'true');
location.reload();
```

## Option 2: Direct localStorage Clear

In the browser console, run:

```javascript
// Remove dashboard layout completely
localStorage.removeItem('dashboardLayout');
location.reload();
```

## What This Does

- Removes all widgets from your dashboard
- Resets the dashboard to an empty state
- Preserves your authentication and other settings

After running either option, your dashboard will be completely empty and you can add fresh widgets using the "Add Widget" button.

## Troubleshooting

If widgets still appear after clearing:
1. Try a hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Clear browser cache for localhost:3002
3. Close and reopen the browser tab