#!/usr/bin/env python3
"""
Debug authentication issue
"""
import sys
sys.path.insert(0, '.')

# Test both password contexts
print("Testing password verification with different contexts:\n")

# Test 1: Backend auth security
from software.backend.auth.security import verify_password as backend_verify, get_password_hash as backend_hash
test_pass = "12345"
test_hash = backend_hash(test_pass)
print(f"Backend auth.security:")
print(f"  Hash for '{test_pass}': {test_hash[:20]}...")
print(f"  Verify: {backend_verify(test_pass, test_hash)}")

# Test 2: Backend auth services
from software.backend.services.auth_services import pwd_context as services_pwd_context
print(f"\nBackend services.auth_services:")
services_hash = services_pwd_context.hash(test_pass)
print(f"  Hash for '{test_pass}': {services_hash[:20]}...")
print(f"  Verify: {services_pwd_context.verify(test_pass, services_hash)}")

# Test 3: Cross verification
print(f"\nCross verification:")
print(f"  Backend security verify with services hash: {backend_verify(test_pass, services_hash)}")
print(f"  Services verify with backend security hash: {services_pwd_context.verify(test_pass, test_hash)}")

# Test with actual database hash
import sqlite3
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()
cursor.execute("SELECT hashed_password FROM users WHERE username = 'jamie'")
db_hash = cursor.fetchone()[0]
conn.close()

print(f"\nDatabase hash for jamie: {db_hash[:20]}...")
print(f"  Backend security verify: {backend_verify(test_pass, db_hash)}")
print(f"  Services verify: {services_pwd_context.verify(test_pass, db_hash)}")