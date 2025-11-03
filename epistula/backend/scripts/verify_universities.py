#!/usr/bin/env python3
"""Verify the temporary university and show what was created."""

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
print(" VERIFICATION: Universities and Temp Schema")
print("="*70)

# Get all universities
response = client.get("/api/v1/universities/")
if response.status_code == 200:
    universities = response.json()
    
    print(f"\nTotal universities: {len(universities)}")
    print("\n" + "-"*70)
    
    for uni in universities:
        status = "🟢 ACTIVE" if uni.get("is_active") else "🔴 INACTIVE (TEMP)"
        print(f"\n{status}")
        print(f"  ID: {uni['id']}")
        print(f"  Name: {uni['name']}")
        print(f"  Code: {uni['code']}")
        print(f"  Schema: {uni['schema_name']}")
        
        # Get temp status if this is a regular university
        if uni.get("is_active"):
            temp_response = client.get(f"/api/v1/backups/{uni['id']}/temp-status")
            if temp_response.status_code == 200:
                temp_data = temp_response.json()
                if temp_data.get("has_temp"):
                    print(f"  📦 Has temp schema: {temp_data.get('temp_schema_name')}")
                    print(f"     Temp university ID: {temp_data.get('temp_university_id')}")
    
    print("\n" + "="*70)
    print(" Summary")
    print("="*70)
    
    active_unis = [u for u in universities if u.get("is_active")]
    temp_unis = [u for u in universities if not u.get("is_active")]
    
    print(f"Active universities: {len(active_unis)}")
    print(f"Temporary/Inactive universities: {len(temp_unis)}")
    
    if temp_unis:
        print(f"\nYou can promote temporary university to production using:")
        for temp in temp_unis:
            # Find the original university
            schema_base = temp['schema_name'].replace('_temp', '')
            original = next((u for u in active_unis if u['schema_name'] == schema_base), None)
            if original:
                print(f"  POST /api/v1/backups/{original['id']}/promote-temp")
else:
    print(f"Failed to get universities: {response.status_code}")
