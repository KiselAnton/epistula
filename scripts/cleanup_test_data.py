"""
Cleanup script to remove all test universities and their backups.
This script removes:
- All universities created during testing (UNI1, UNI2, temp universities, etc.)
- All database schemas (including temp schemas)
- All backup files from MinIO
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi.testclient import TestClient
from main import app
from middleware.auth import DummyUser
from utils.database import get_db
from sqlalchemy import text
from unittest.mock import patch

client = TestClient(app)

def cleanup_test_universities():
    """Remove all test universities and their data."""
    
    # Use DummyUser as root for all requests
    with patch('middleware.auth.get_current_user', return_value=DummyUser(
        email="root@epistula.edu",
        full_name="Root User", 
        role="root",
        university_id=None,
        sub="root@epistula.edu"
    )):
        print("\n" + "="*70)
        print(" Cleaning Up Test Universities")
        print("="*70)
        
        # Get all universities
        response = client.get("/api/v1/universities/")
        if response.status_code != 200:
            print(f"❌ Failed to fetch universities: {response.status_code}")
            return
        
        universities = response.json()
        test_unis = [
            u for u in universities 
            if u['code'] in ['UNI1', 'UNI2', 'UNI2_TEMP'] or 
               'Test University' in u['name'] or
               u['code'].startswith('PROF') or
               u['code'].startswith('STU') or
               u['code'].startswith('ADM') or
               u['code'].startswith('TESTF')
        ]
        
        if not test_unis:
            print("\n✅ No test universities found to clean up.")
            print("="*70 + "\n")
            return
        
        print(f"\nFound {len(test_unis)} test universities to clean up...")
        
        # Clean up each university
        for uni in test_unis:
            uni_id = uni['id']
            uni_code = uni['code']
            schema_name = uni['schema_name']
            
            print(f"\n🗑️  Cleaning up: {uni['name']} (ID: {uni_id}, Schema: {schema_name})")
            
            # 1. Delete all backups for this university
            try:
                backups_response = client.get(f"/api/v1/backups/{uni_id}")
                if backups_response.status_code == 200:
                    backups = backups_response.json()
                    if backups:
                        print(f"   Found {len(backups)} backup(s) to delete...")
                        for backup in backups:
                            backup_name = backup['filename']
                            delete_resp = client.delete(f"/api/v1/backups/{uni_id}/{backup_name}")
                            if delete_resp.status_code == 200:
                                print(f"   ✓ Deleted backup: {backup_name}")
                            else:
                                print(f"   ✗ Failed to delete backup {backup_name}: {delete_resp.status_code}")
            except Exception as e:
                print(f"   ⚠️  Error cleaning backups: {e}")
            
            # 2. Drop temp schema if exists
            temp_schema = f"{schema_name}_temp"
            try:
                db = next(get_db())
                result = db.execute(
                    text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"),
                    {"name": temp_schema}
                ).fetchone()
                
                if result:
                    print(f"   Dropping temp schema: {temp_schema}")
                    db.execute(text(f"DROP SCHEMA IF EXISTS {temp_schema} CASCADE"))
                    db.commit()
                    print(f"   ✓ Dropped temp schema: {temp_schema}")
                
                db.close()
            except Exception as e:
                print(f"   ⚠️  Error dropping temp schema: {e}")
            
            # 3. Delete the university (this will also drop the main schema via CASCADE)
            delete_response = client.delete(f"/api/v1/universities/{uni_id}")
            if delete_response.status_code == 200:
                print(f"   ✓ Deleted university and schema: {schema_name}")
            else:
                print(f"   ✗ Failed to delete university: {delete_response.status_code}")
                # Try to manually drop the schema
                try:
                    db = next(get_db())
                    print(f"   Attempting manual schema drop: {schema_name}")
                    db.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))
                    db.commit()
                    print(f"   ✓ Manually dropped schema: {schema_name}")
                    db.close()
                except Exception as e:
                    print(f"   ✗ Failed to manually drop schema: {e}")
        
        print("\n" + "="*70)
        print(" Cleanup Complete!")
        print("="*70)
        
        # Verify cleanup
        response = client.get("/api/v1/universities/")
        if response.status_code == 200:
            remaining = response.json()
            test_remaining = [
                u for u in remaining 
                if u['code'] in ['UNI1', 'UNI2', 'UNI2_TEMP'] or 
                   'Test University' in u['name']
            ]
            
            if test_remaining:
                print(f"\n⚠️  {len(test_remaining)} test universities still remain:")
                for u in test_remaining:
                    print(f"   - {u['name']} (ID: {u['id']}, Code: {u['code']})")
            else:
                print("\n✅ All test universities successfully removed!")
        
        print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    cleanup_test_universities()
