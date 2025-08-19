# Quick OAuth Setup Guide

The signup page includes Google OAuth integration, but it requires configuration to work.

## For Development (Without Google OAuth)

You can use the signup page without configuring Google OAuth:
1. Simply use the email/password form
2. The Google button will show an error message if clicked

## To Enable Google OAuth

1. Follow the detailed guide at: `software/docs/GOOGLE_OAUTH_SETUP.md`
2. Set these environment variables before starting the backend:
   ```bash
   export GOOGLE_CLIENT_ID="your-client-id-here"
   export GOOGLE_CLIENT_SECRET="your-client-secret-here"
   ```
3. Restart the backend server

## Note

Google OAuth is optional. The application works perfectly fine with email/password authentication.