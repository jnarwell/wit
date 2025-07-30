# Google OAuth Test Instructions

## Current Status
✅ Google Client ID is set
✅ Google Client Secret is set
✅ OAuth endpoints are working
✅ Redirect URI is configured

## To Test OAuth:

### 1. Navigate to Settings Page
Since your app doesn't use traditional routing, you need to:
- Click on your user menu (top right)
- Click on "Settings" option
- OR directly go to: http://localhost:3000/?page=settings

### 2. Connect Google Account
1. In Settings, go to "Connected Accounts" tab
2. Find the Google card
3. Click the "Connect" button
4. You'll be redirected to Google's authorization page
5. Sign in with your Google account
6. Authorize the requested permissions
7. You'll be redirected back to the app

### 3. Check Results
After authorization, you should see:
- Google account shows as "Connected" ✓
- Your Google email displayed
- "Disconnect" button appears

### 4. If It's Not Working
Check the server logs:
```bash
# Look for OAuth callback logs
grep -i "oauth\|callback\|linked" server_oauth_final.log | tail -50

# Check for errors
grep -i "error\|exception" server_oauth_final.log | tail -20
```

### 5. Common Issues
- **Still shows "Not connected"**: The callback might not be saving the account
- **Redirect error**: Check if the redirect URI matches exactly in Google Cloud Console
- **No logs**: The callback might not be hitting the server

### 6. Debug Info
To see what's happening, open browser DevTools:
1. Network tab → Look for `/api/v1/auth/google/callback`
2. Console → Check for any JavaScript errors
3. Application → Local Storage → Check for auth tokens

The OAuth flow should work now that the client secret is set!