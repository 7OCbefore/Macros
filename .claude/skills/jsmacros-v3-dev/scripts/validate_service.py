import sys
import os
import re

def validate_service(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    errors = []

    # Check for JSDoc header
    if not re.search(r'/\*\*\s+\*\s+@file', content):
        errors.append("Missing JSDoc @file header")

    # Check for CommonJS require
    if "require(" not in content and "module.exports" not in content:
        errors.append("Does not appear to be a CommonJS module")

    # Check for hardcoded absolute paths
    if re.search(r'["\'][CDE]:\', content):
        errors.append("Found hardcoded absolute filesystem path")

    if errors:
        for err in errors:
            print(f"FAIL: {err}")
        return False
    
    print("PASS: Service follows basic v3 conventions.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_service.py <path_to_js_file>")
    else:
        validate_service(sys.argv[1])
