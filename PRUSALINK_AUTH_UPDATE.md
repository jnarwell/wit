# PrusaLink Authentication Update

## What Changed
PrusaLink has been updated to use username/password authentication instead of API keys.

## Configuration
The following environment variables are now used:
- `PRUSALINK_HOST`: IP address of your printer (e.g., 192.168.1.134)
- `PRUSALINK_USERNAME`: Username (default: "maker")
- `PRUSALINK_PASSWORD`: Password from printer display
- `PRUSALINK_HOSTNAME`: Hostname of printer (e.g., "prusa-xl")

## Finding Your Credentials
1. On your Prusa printer, go to: Settings → Network → PrusaLink
2. Note the username (usually "maker")
3. Note the password displayed
4. Note the IP address

## Files Updated
- `setup-network-printer.py`: Now asks for username/password
- `software/integrations/prusalink-integration.py`: Uses Basic Auth
- `software/frontend/web/src/pages/MachinesPage.tsx`: Updated UI
- `.env`: Your configuration file

## Testing
Run the setup wizard to test your connection:
```bash
python3 setup-network-printer.py
```

Choose option 1 for PrusaLink and enter your credentials.
