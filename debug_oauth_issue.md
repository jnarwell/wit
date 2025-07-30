# OAuth Debug Guide

## The Issue
After completing Google OAuth authorization, you're redirected back but the account isn't linked.

## Possible Causes

### 1. Missing Google Client Secret
The OAuth token exchange requires a client secret. Check if it's set:
```bash
env | grep GOOGLE_CLIENT_SECRET
```

If not set, you need to:
1. Get the client secret from Google Cloud Console
2. Set it: `export GOOGLE_CLIENT_SECRET="your-secret-here"`
3. Restart the server

### 2. OAuth Callback Not Being Hit
Check if the callback URL is being accessed after Google authorization.

In your browser's Developer Tools:
1. Open Network tab
2. Complete the OAuth flow
3. Look for: `/api/v1/auth/google/callback?code=...&state=...`

### 3. Frontend Routing Issue
The app redirects to `/?page=settings&linked=google&status=success`
But your app might be at `/dashboard` instead of `/`

## Quick Test
Run this to check the OAuth callback directly:
```bash
# Get a state token first
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=verifyuser&password=verifypass123" \
  -s | python3 -c "import json; j=json.load(__import__('sys').stdin); print(j['access_token'])" > /tmp/token.txt

TOKEN=$(cat /tmp/token.txt)

# Get OAuth URL
curl -X POST http://localhost:8000/api/v1/accounts/link/google \
  -H "Authorization: Bearer $TOKEN" \
  -s | python3 -m json.tool
```

Then check server logs for any callback activity.

## Solution Steps

1. **Set Client Secret** (most likely issue)
   ```bash
   export GOOGLE_CLIENT_SECRET="your-actual-secret"
   export GOOGLE_CLIENT_ID="54902465207-h74ibu5q2qd8pmebn4a8iae4f7vrma6d.apps.googleusercontent.com"
   ```

2. **Restart Server**
   ```bash
   # Kill current server
   kill $(ps aux | grep uvicorn | grep -v grep | awk '{print $2}')
   
   # Start with secrets
   python3 -m uvicorn software.backend.dev_server:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Test OAuth Flow**
   - Go to Settings page
   - Click "Connect" on Google
   - Complete authorization
   - Check if account appears as linked

4. **Check Logs**
   Look for these log messages:
   - "OAuth callback for google"
   - "Token exchange successful"
   - "Successfully linked google account"