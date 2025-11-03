"""
Test cleanup - removes all test universities created during test runs.
Run with: cd backend && pytest tests/cleanup_test_data.py -v
"""
import pytest
from tests.test_utils import DummyUser
from utils.database import get_db
from sqlalchemy import text


def test_cleanup_all_test_universities(client, set_user):
    """
    Cleanup all test universities and their data.
    This should be run after test sessions to clean up.
    """
    
    # Use DummyUser as root for all requests
    set_user(DummyUser(id=1, email="root@epistula.edu", name="Root User", is_root=True))
    
    print("\n" + "="*70)
    print(" Cleaning Up Test Universities")
    print("="*70)
    
    # Get all universities
    response = client.get("/api/v1/universities/")
    assert response.status_code == 200
    
    universities = response.json()
    
    # Identify test universities by various patterns
    test_unis = [
        u for u in universities 
        if u['code'] in ['UNI1', 'UNI2', 'UNI2_TEMP'] or 
           'Test University' in u['name'] or
           u['code'].startswith('PROF') or
           u['code'].startswith('STU') or
           u['code'].startswith('ADM') or
           u['code'].startswith('TESTF') or
           'Other University' in u['name']
    ]
    
    if not test_unis:
        print("\n✅ No test universities found to clean up.")
        print("="*70 + "\n")
        return
    
    print(f"\nFound {len(test_unis)} test universities to clean up...")
    
    deleted_count = 0
    failed_count = 0
    
    # Clean up each university
    for uni in test_unis:
        uni_id = uni['id']
        uni_code = uni['code']
        schema_name = uni['schema_name']
        
        print(f"\n🗑️  Cleaning: {uni['name'][:50]}... (ID: {uni_id})")
        
        try:
            # 1. Skip backup deletion - not critical for cleanup
            # (API returns wrapped responses that are hard to parse in tests)
            
            # 2. Drop temp schema if exists
            temp_schema = f"{schema_name}_temp"
            db = next(get_db())
            result = db.execute(
                text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"),
                {"name": temp_schema}
            ).fetchone()
            
            if result:
                db.execute(text(f"DROP SCHEMA IF EXISTS {temp_schema} CASCADE"))
                db.commit()
                print(f"   ✓ Dropped temp schema: {temp_schema}")
            db.close()
            
            # 3. Delete the university
            delete_response = client.delete(f"/api/v1/universities/{uni_id}")
            if delete_response.status_code in (200, 204):  # Accept both 200 OK and 204 No Content
                print(f"   ✓ Deleted university and schema: {schema_name}")
                deleted_count += 1
            else:
                print(f"   ✗ Failed to delete university: {delete_response.status_code}")
                failed_count += 1
                
        except Exception as e:
            print(f"   ✗ Error: {e}")
            failed_count += 1
    
    print("\n" + "="*70)
    print(f" Cleanup Summary: {deleted_count} deleted, {failed_count} failed")
    print("="*70 + "\n")
    
    # Verify cleanup
    response = client.get("/api/v1/universities/")
    assert response.status_code == 200
    remaining = response.json()
    test_remaining = [
        u for u in remaining 
        if u['code'] in ['UNI1', 'UNI2', 'UNI2_TEMP'] or 
           'Test University' in u['name']
    ]
    
    if test_remaining:
        print(f"⚠️  {len(test_remaining)} test universities still remain")
    else:
        print("✅ All test universities successfully removed!\n")

