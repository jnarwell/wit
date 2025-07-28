# Email Verification in Development

During development, the email verification system works locally without requiring an actual email service.

## How it Works

When a user signs up:

1. **Console Output**: The verification link is logged to the backend console
   - Look for the section marked with `=====`
   - Copy the verification link and paste it in your browser

2. **File Storage**: Verification emails are saved to `dev_emails/` directory
   - Each email is saved as a `.txt` file with timestamp
   - Contains the full email content including the verification link

3. **Auto-Open Option**: Set environment variable to auto-open links
   ```bash
   export AUTO_OPEN_VERIFICATION=true
   ```

## Testing Email Verification

1. Sign up with a new account at http://localhost:3001/signup
2. Check the backend console for the verification link
3. Click the link or copy/paste it to your browser
4. You'll be redirected to the verification success page
5. Now you can log in with your credentials

## File Locations

- Verification emails: `dev_emails/verification_*.txt`
- These files are gitignored and won't be committed

## Production Setup

For production, you'll need to:

1. Set up an email service (SendGrid, AWS SES, etc.)
2. Update `send_verification_email()` in `auth_router.py`
3. Add email service credentials to environment variables
4. Update the verification link domain

## Troubleshooting

- **Can't find verification link**: Check the backend console output
- **Link expired**: Tokens expire after 24 hours
- **User still inactive**: Make sure you clicked the correct link
- **Dev emails not created**: Check write permissions in the project directory