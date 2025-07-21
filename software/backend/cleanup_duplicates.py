#!/usr/bin/env python3
"""Remove duplicate model definitions"""

with open("models/database_models.py", "r") as f:
    lines = f.readlines()

# Track which models we've seen
seen_models = set()
output_lines = []
skip_until = -1

for i, line in enumerate(lines):
    if i < skip_until:
        continue
        
    if line.strip().startswith("class ") and "(Base)" in line:
        # Extract model name
        model_name = line.strip().split()[1].rstrip("(Base):")
        
        if model_name in seen_models:
            print(f"Found duplicate: {model_name} at line {i+1}")
            # Skip this class definition
            indent = len(line) - len(line.lstrip())
            skip_until = i + 1
            
            # Find end of class
            for j in range(i + 1, len(lines)):
                if lines[j].strip() and (len(lines[j]) - len(lines[j].lstrip())) <= indent:
                    skip_until = j
                    break
            continue
        else:
            seen_models.add(model_name)
    
    output_lines.append(line)

# Write cleaned file
with open("models/database_models.py", "w") as f:
    f.writelines(output_lines)

print(f"✅ Removed duplicates. Models found: {len(seen_models)}")
