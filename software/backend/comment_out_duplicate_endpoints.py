#!/usr/bin/env python3
"""
Script to comment out duplicate endpoints in dev_server.py
"""

import re

# Read the file
with open('dev_server.py', 'r') as f:
    lines = f.readlines()

# Find and comment out the terminal_command function
in_terminal_command = False
in_log_ai_message = False
indent_level = None

for i in range(len(lines)):
    # Check if we're starting the terminal_command function
    if 'async def terminal_command' in lines[i] and '@app.post' not in lines[i]:
        in_terminal_command = True
        lines[i] = '#' + lines[i]
        indent_level = len(lines[i]) - len(lines[i].lstrip())
        continue
    
    # Check if we're starting the log_ai_message function
    if 'async def log_ai_message' in lines[i] and '@app.post' not in lines[i]:
        in_log_ai_message = True
        lines[i] = '#' + lines[i]
        indent_level = len(lines[i]) - len(lines[i].lstrip())
        continue
    
    # Comment out lines in the function
    if in_terminal_command or in_log_ai_message:
        # Check if we've reached the end of the function
        if lines[i].strip() and not lines[i].startswith(' ') and not lines[i].startswith('\t'):
            in_terminal_command = False
            in_log_ai_message = False
            indent_level = None
        elif lines[i].strip():  # Non-empty line
            # Check if still in function based on indentation
            current_indent = len(lines[i]) - len(lines[i].lstrip())
            if current_indent == 0:
                in_terminal_command = False
                in_log_ai_message = False
                indent_level = None
            else:
                lines[i] = '#' + lines[i]

# Write back
with open('dev_server.py', 'w') as f:
    f.writelines(lines)

print("Duplicate endpoints commented out successfully!")