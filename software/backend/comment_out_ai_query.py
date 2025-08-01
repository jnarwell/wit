#!/usr/bin/env python3
"""
Script to comment out ai_query function in dev_server.py
"""

# Read the file
with open('dev_server.py', 'r') as f:
    lines = f.readlines()

# Find and comment out the ai_query function
in_ai_query = False
indent_level = None

for i in range(len(lines)):
    # Check if we're starting the ai_query function
    if 'async def ai_query' in lines[i] and 'Depends' in lines[i]:
        in_ai_query = True
        if not lines[i].strip().startswith('#'):
            lines[i] = '# ' + lines[i]
        continue
    
    # Comment out lines in the function
    if in_ai_query:
        # Check if we've reached the end of the function
        if lines[i].strip() and not lines[i].startswith(' ') and not lines[i].startswith('\t'):
            in_ai_query = False
            indent_level = None
        elif lines[i].strip():  # Non-empty line
            # Check if still in function based on indentation
            current_indent = len(lines[i]) - len(lines[i].lstrip())
            if current_indent == 0 and not lines[i].strip().startswith('#'):
                in_ai_query = False
                indent_level = None
            else:
                if not lines[i].strip().startswith('#'):
                    lines[i] = '# ' + lines[i]

# Write back
with open('dev_server.py', 'w') as f:
    f.writelines(lines)

print("AI query endpoint commented out successfully!")