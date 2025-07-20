#!/bin/bash
# Update PrusaLink configuration to use username/password authentication

echo "🔧 Updating PrusaLink Configuration"
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp software/.env.example .env
fi

# Add PrusaLink configuration to .env
echo ""
echo "Adding PrusaLink configuration to .env file..."

# Check if PrusaLink config already exists
if grep -q "PRUSALINK_" .env; then
    echo "PrusaLink configuration found in .env, updating..."
    # Comment out old entries
    sed -i.bak 's/^PRUSALINK_/#PRUSALINK_/g' .env
fi

# Add new configuration
cat >> .env << EOF

# PrusaLink Configuration (Updated)
PRUSALINK_HOST=192.168.1.134
PRUSALINK_USERNAME=maker
PRUSALINK_PASSWORD=6kSsqbykCym6Xd8
PRUSALINK_HOSTNAME=prusa-xl
EOF

echo "✅ Updated .env file with PrusaLink credentials"

# Update the example file too
echo ""
echo "Updating .env.example template..."

# Update the .env.example to show the new format
cat >> software/.env.example << EOF

# PrusaLink Configuration
PRUSALINK_HOST=192.168.1.xxx
PRUSALINK_USERNAME=maker
PRUSALINK_PASSWORD=your_prusalink_password
PRUSALINK_HOSTNAME=prusa-xl
EOF

echo "✅ Updated .env.example"

# Create a migration note
cat > PRUSALINK_AUTH_UPDATE.md << EOF
# PrusaLink Authentication Update

## What Changed
PrusaLink has been updated to use username/password authentication instead of API keys.

## Configuration
The following environment variables are now used:
- \`PRUSALINK_HOST\`: IP address of your printer (e.g., 192.168.1.134)
- \`PRUSALINK_USERNAME\`: Username (default: "maker")
- \`PRUSALINK_PASSWORD\`: Password from printer display
- \`PRUSALINK_HOSTNAME\`: Hostname of printer (e.g., "prusa-xl")

## Finding Your Credentials
1. On your Prusa printer, go to: Settings → Network → PrusaLink
2. Note the username (usually "maker")
3. Note the password displayed
4. Note the IP address

## Files Updated
- \`setup-network-printer.py\`: Now asks for username/password
- \`software/integrations/prusalink-integration.py\`: Uses Basic Auth
- \`software/frontend/web/src/pages/MachinesPage.tsx\`: Updated UI
- \`.env\`: Your configuration file

## Testing
Run the setup wizard to test your connection:
\`\`\`bash
python3 setup-network-printer.py
\`\`\`

Choose option 1 for PrusaLink and enter your credentials.
EOF

echo ""
echo "✅ Created PRUSALINK_AUTH_UPDATE.md with migration notes"

# Summary
echo ""
echo "🎉 PrusaLink Authentication Update Complete!"
echo ""
echo "Next steps:"
echo "1. Review your .env file to ensure the credentials are correct"
echo "2. Run: python3 setup-network-printer.py"
echo "3. Choose option 1 (PrusaLink) to test the connection"
echo ""
echo "Your PrusaLink configuration:"
echo "  Host: 192.168.1.134"
echo "  Username: maker"
echo "  Password: [configured in .env]"
echo "  Hostname: prusa-xl"
echo ""
echo "⚠️  Security Note: Keep your .env file private and never commit it to git!"