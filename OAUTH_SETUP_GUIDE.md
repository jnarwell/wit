# OAuth Setup Guide - Fixing Redirect URI Mismatch

## The Problem
You're getting a `redirect_uri_mismatch` error because the redirect URI in your OAuth request doesn't match what's configured in Google Cloud Console.

## Current Configuration
- **OAuth Request Redirect URI**: `http://localhost:8000/api/v1/auth/google/callback`
- **Frontend URL**: `http://localhost:3000`
- **Backend URL**: `http://localhost:8000`

## Solution Steps

### 1. Add the Redirect URI to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID (the one with ID: `54902465207-h74ibu5q2qd8pmebn4a8iae4f7vrma6d.apps.googleusercontent.com`)
4. In the **Authorized redirect URIs** section, add EXACTLY this URI:
   ```
   http://localhost:8000/api/v1/auth/google/callback
   ```
5. Click **Save**

### 2. Common Mistakes to Avoid

❌ **Wrong**:
- `https://localhost:8000/api/v1/auth/google/callback` (https instead of http)
- `http://localhost:8000/api/v1/auth/google/callback/` (trailing slash)
- `http://localhost:8000/auth/google/callback` (missing /api/v1)
- `http://localhost:3000/api/v1/auth/google/callback` (wrong port)

✅ **Correct**:
- `http://localhost:8000/api/v1/auth/google/callback`

### 3. How the OAuth Flow Works

1. **User clicks "Connect Google"** in frontend (http://localhost:3000)
2. **Frontend calls** `/api/v1/accounts/link/google` (proxied to backend on port 8000)
3. **Backend returns** OAuth URL with redirect_uri pointing to port 8000
4. **Browser redirects** to Google's OAuth consent page
5. **Google redirects back** to `http://localhost:8000/api/v1/auth/google/callback`
6. **Backend processes** the callback and redirects to frontend settings page

### 4. Testing the Fix

After adding the redirect URI to Google Cloud Console:

1. Clear your browser cache/cookies for Google
2. Go to http://localhost:3000/settings
3. Click "Connect" on Google
4. You should see Google's consent page
5. After authorization, you'll be redirected back to the settings page

### 5. Alternative Solutions

If you still have issues, you can try:

#### Option A: Use Frontend Port
Set environment variable to use port 3000:
```bash
export GOOGLE_REDIRECT_URI="http://localhost:3000/api/v1/auth/google/callback"
```
Then add this URI to Google Cloud Console.

#### Option B: Multiple Redirect URIs
Add all these URIs to Google Cloud Console:
- `http://localhost:8000/api/v1/auth/google/callback`
- `http://localhost:3000/api/v1/auth/google/callback`
- `http://localhost:3001/api/v1/auth/google/callback`

### 6. Verify Your Setup

Run this command to see the exact OAuth URL being generated:
```bash
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=verifyuser&password=verifypass123" \
  -s | python3 -m json.tool | grep access_token | cut -d'"' -f4 > /tmp/token.txt && \
TOKEN=$(cat /tmp/token.txt) && \
curl -X POST http://localhost:8000/api/v1/accounts/link/google \
  -H "Authorization: Bearer $TOKEN" \
  -s | python3 -m json.tool | grep auth_url
```

The `redirect_uri` parameter in the URL should match EXACTLY what you added to Google Cloud Console.