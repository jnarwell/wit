# Google OAuth Setup Guide

This guide will help you set up Google OAuth for the W.I.T. application.

## Prerequisites

1. A Google account
2. Access to Google Cloud Console

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "WIT Application")
5. Click "Create"

### 2. Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" for user type
   - Fill in the required fields:
     - App name: "W.I.T. Application"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if in development

4. After consent screen is configured, create OAuth client ID:
   - Application type: "Web application"
   - Name: "WIT Web Client"
   - Authorized JavaScript origins:
     ```
     http://localhost:3001
     http://localhost:8000
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:8000/api/v1/auth/google/callback
     ```
   - Click "Create"

### 4. Save Your Credentials

After creation, you'll receive:
- **Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
- **Client Secret**: A long string of characters

### 5. Configure the Application

Create a `.env` file in your backend directory (`software/frontend/web/`) with:

```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

Or set them as environment variables:

```bash
export GOOGLE_CLIENT_ID="your-client-id-here"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

### 6. Update Frontend (Optional)

If you want to use Google's JavaScript SDK for a smoother experience, update the frontend configuration in `software/frontend/web/.env`:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here
```

## Troubleshooting

### Error 401: invalid_client

This error occurs when:
1. The client ID or secret is incorrect
2. The redirect URI doesn't match exactly what's configured in Google Cloud Console
3. The OAuth consent screen is not properly configured

### Error 400: redirect_uri_mismatch

Make sure the redirect URI in your code matches EXACTLY what's configured in Google Cloud Console, including:
- Protocol (http/https)
- Domain
- Port
- Path

### Development vs Production

For production deployment:
1. Update authorized origins and redirect URIs to use your production domain
2. Use HTTPS for all URLs
3. Store credentials securely (use environment variables or secret management service)
4. Consider implementing a more robust token storage system (Redis, database)

## Security Best Practices

1. Never commit credentials to version control
2. Use environment variables for sensitive data
3. Implement proper session management
4. Use HTTPS in production
5. Regularly rotate client secrets
6. Monitor OAuth usage in Google Cloud Console

## Testing

To test the OAuth flow:
1. Start your backend server: `python3 -m software.frontend.web.dev_server`
2. Start your frontend: `npm run dev`
3. Navigate to the signup page
4. Click "Continue with Google"
5. You should be redirected to Google's login page
6. After authorization, you'll be redirected back to your application

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google Cloud Console](https://console.cloud.google.com/)