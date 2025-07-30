#!/bin/bash
# Run the development server with all the fixes

cd /Users/jmarwell/Documents/wit/software/backend
echo "Starting W.I.T. Development Server..."
echo "This server includes:"
echo "- Fixed project endpoints (GET/PUT/DELETE)"
echo "- Fixed task management"
echo "- Fixed admin panel user creation/deletion"
echo "- Real file system operations"
echo ""
echo "Default login: admin/admin"
echo ""

python3 dev_server.py