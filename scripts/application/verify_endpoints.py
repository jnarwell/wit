#!/usr/bin/env python3
"""
Fix SyntaxError: expected 'except' or 'finally' block in dev_server.py
"""

import os
import re

def fix_syntax_error():
    """Fix the missing except block in dev_server.py"""
    print("🔧 Fixing SyntaxError in dev_server.py...")
    
    if not os.path.exists("dev_server.py"):
        print("❌ dev_server.py not found!")
        return False
    
    with open("dev_server.py", 'r') as f:
        lines = f.readlines()
    
    # Find the problematic area around line 886
    print(f"  📍 Found {len(lines)} lines in dev_server.py")
    
    # Look for unclosed try blocks
    fixed = False
    in_try_block = False
    try_line_num = 0
    indent_level = ""
    
    new_lines = []
    
    for i, line in enumerate(lines):
        # Check if we're starting a try block
        if re.match(r'^(\s*)try\s*:', line):
            in_try_block = True
            try_line_num = i + 1
            indent_level = re.match(r'^(\s*)', line).group(1)
            new_lines.append(line)
            continue
        
        # Check if we're in a try block and hit a line at the same or lesser indentation
        # without finding except/finally
        if in_try_block:
            current_indent = re.match(r'^(\s*)', line).group(1) if line.strip() else None
            
            # Check for except or finally
            if re.match(rf'^{indent_level}(except|finally)', line):
                in_try_block = False
                new_lines.append(line)
                continue
            
            # If we hit a line with same or less indentation (and it's not empty)
            # it means the try block ended without except/finally
            if (line.strip() and current_indent is not None and 
                len(current_indent) <= len(indent_level) and 
                not line.strip().startswith('#')):
                
                print(f"  ⚠️  Found unclosed try block at line {try_line_num}")
                print(f"     Adding except block before line {i + 1}: {line.strip()[:50]}...")
                
                # Add the missing except block
                new_lines.append(f"{indent_level}except Exception as e:\n")
                new_lines.append(f"{indent_level}    logger.error(f'Error in try block at line {try_line_num}: {{e}}')\n")
                new_lines.append(f"{indent_level}    pass\n")
                new_lines.append("\n")
                
                in_try_block = False
                fixed = True
        
        new_lines.append(line)
    
    # If we're still in a try block at the end, close it
    if in_try_block:
        print(f"  ⚠️  Unclosed try block at end of file (started at line {try_line_num})")
        new_lines.append(f"{indent_level}except Exception as e:\n")
        new_lines.append(f"{indent_level}    logger.error(f'Error in try block at line {try_line_num}: {{e}}')\n")
        new_lines.append(f"{indent_level}    pass\n")
        fixed = True
    
    if fixed:
        # Write the fixed content
        with open("dev_server.py", 'w') as f:
            f.writelines(new_lines)
        print("✅ Fixed syntax error!")
        return True
    else:
        print("  🔍 Looking for the specific error around line 886...")
        
        # More targeted fix around line 886
        if len(lines) > 886:
            # Check lines around 886
            for i in range(max(0, 880), min(len(lines), 890)):
                if 'try:' in lines[i]:
                    print(f"  Found try block at line {i + 1}")
                    
                    # Find where to insert the except
                    for j in range(i + 1, min(len(lines), i + 20)):
                        if lines[j].strip() and not lines[j].startswith(' '):
                            # Insert except before this line
                            lines.insert(j, "    except Exception as e:\n")
                            lines.insert(j + 1, "        logger.error(f'Error: {e}')\n")
                            lines.insert(j + 2, "        pass\n")
                            lines.insert(j + 3, "\n")
                            
                            with open("dev_server.py", 'w') as f:
                                f.writelines(lines)
                            
                            print(f"✅ Added except block before line {j + 1}")
                            return True
    
    print("❌ Could not automatically fix the error")
    return False


def create_manual_fix():
    """Create a manual fix script"""
    print("\n📝 Creating manual fix instructions...")
    
    manual_fix = '''#!/usr/bin/env python3
"""
Manual fix for the SyntaxError in dev_server.py

The error "SyntaxError: expected 'except' or 'finally' block" means there's a try block
without a corresponding except or finally block.

To fix manually:
1. Open dev_server.py in your editor
2. Go to line 886 or search for "if status:"
3. Look ABOVE this line for a "try:" statement
4. Add an except block after the try block's content

Example fix:
    try:
        # some code here
        status = await get_real_printer_status(printer_id)
    except Exception as e:
        logger.error(f"Error getting printer status: {e}")
        status = None
    
    if status:
        # rest of the code
"""

import subprocess
import sys

print("Opening dev_server.py in your default editor...")
print("Look for the try block before line 886 and add an except block")

# Try to open in default editor
try:
    if sys.platform == "darwin":  # macOS
        subprocess.run(["open", "-e", "dev_server.py"])
    elif sys.platform == "win32":  # Windows
        subprocess.run(["notepad", "dev_server.py"])
    else:  # Linux
        subprocess.run(["nano", "dev_server.py"])
except:
    print("Please open dev_server.py manually in your editor")
'''
    
    with open("manual_fix_syntax.py", "w") as f:
        f.write(manual_fix)
    
    os.chmod("manual_fix_syntax.py", 0o755)
    print("✅ Created manual_fix_syntax.py")


def create_quick_patch():
    """Create a quick patch that finds and fixes the specific error"""
    print("\n🩹 Creating quick patch...")
    
    patch_script = '''#!/usr/bin/env python3
"""Quick patch for syntax error around line 886"""

import re

print("🩹 Applying quick patch for syntax error...")

with open("dev_server.py", 'r') as f:
    content = f.read()

# Find try blocks without except
lines = content.split('\\n')
fixed_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Look for try blocks
    if re.match(r'^(\\s*)try\\s*:', line):
        indent = re.match(r'^(\\s*)', line).group(1)
        fixed_lines.append(line)
        i += 1
        
        # Collect the try block content
        try_content = []
        while i < len(lines):
            if re.match(f'^{indent}(except|finally)', lines[i]):
                # Found except/finally, we're good
                break
            elif lines[i].strip() and not lines[i].startswith(indent + ' ') and not lines[i].startswith(indent + '\\t'):
                # End of try block without except
                print(f"  Found unclosed try block before line {i + 1}")
                fixed_lines.append(f"{indent}except Exception as e:")
                fixed_lines.append(f"{indent}    logger.error(f'Error: {{e}}')")
                fixed_lines.append(f"{indent}    pass")
                break
            else:
                try_content.append(lines[i])
                i += 1
        
        # Add the content we collected
        fixed_lines.extend(try_content)
    else:
        fixed_lines.append(line)
        i += 1

# Write the fixed content
with open("dev_server.py", 'w') as f:
    f.write('\\n'.join(fixed_lines))

print("✅ Applied syntax error patch!")
print("   Try running: python3 dev_server.py")
'''
    
    with open("quick_patch_syntax.py", "w") as f:
        f.write(patch_script)
    
    os.chmod("quick_patch_syntax.py", 0o755)
    print("✅ Created quick_patch_syntax.py")


def main():
    print("🚨 Fixing SyntaxError in dev_server.py")
    print("=====================================\n")
    
    # Try automatic fix
    if fix_syntax_error():
        print("\n✅ Syntax error fixed!")
        print("\n🎯 Next step: python3 dev_server.py")
    else:
        # Create helper scripts
        create_quick_patch()
        create_manual_fix()
        
        print("\n❌ Could not automatically fix the error")
        print("\n🔧 Try these options:")
        print("\n1. Run the quick patch:")
        print("   python3 quick_patch_syntax.py")
        print("\n2. Fix manually:")
        print("   python3 manual_fix_syntax.py")
        print("\n3. Or add this before line 886:")
        print("   except Exception as e:")
        print("       logger.error(f'Error: {e}')")
        print("       pass")


if __name__ == "__main__":
    main()