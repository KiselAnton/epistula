#!/usr/bin/env python3
"""Test backup and restore functionality on existing universities."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from middleware.auth import get_current_user

class DummyUser:
    def __init__(self):
        self.id = 1
        self.email = "root@epistula.edu"
        self.is_root = True

app.dependency_overrides[get_current_user] = lambda: DummyUser()
client = TestClient(app)

print("="*70)
print(" TESTING BACKUP AND RESTORE FUNCTIONALITY")
print("="*70)

# Test on University 2 (ID 1168)
uni_id = 1168

print(f"\n1. Creating backup for University {uni_id}...")
backup_response = client.post(f"/api/v1/backups/{uni_id}/create")
print(f"   Status: {backup_response.status_code}")

if backup_response.status_code == 200:
    backup_data = backup_response.json()
    print(f"   ✓ Backup created: {backup_data.get('filename')}")
    print(f"   Size: {backup_data.get('size_bytes')} bytes")
    
    backup_filename = backup_data.get("filename")
    
    if backup_filename:
        print(f"\n2. Restoring backup as temporary schema...")
        restore_response = client.post(
            f"/api/v1/backups/{uni_id}/{backup_filename}/restore",
            params={"to_temp": True}
        )
        print(f"   Status: {restore_response.status_code}")
        
        if restore_response.status_code == 200:
            restore_data = restore_response.json()
            print(f"   ✓ Restored to temporary schema: {restore_data.get('schema_name')}")
            print(f"\n{'='*70}")
            print(" SUCCESS! Backup and restore-to-temp working!")
            print(f"{'='*70}")
            print(f"\nTemporary schema '{restore_data.get('schema_name')}' created from backup.")
            print("You can now validate the data before promoting to production.")
        else:
            print(f"   ✗ Failed to restore: {restore_response.text}")
    else:
        print("   ✗ No backup filename in response")
else:
    print(f"   ✗ Failed to create backup: {backup_response.text}")
