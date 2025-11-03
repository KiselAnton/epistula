"""
Display the two test universities (UNI1 and UNI2) created for testing.
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi.testclient import TestClient
from main import app
from middleware.auth import DummyUser

# Override auth for testing
from unittest.mock import patch

client = TestClient(app)

# Use DummyUser as root for all requests
with patch('middleware.auth.get_current_user', return_value=DummyUser(
    email="root@epistula.edu",
    full_name="Root User", 
    role="root",
    university_id=None,
    sub="root@epistula.edu"
)):
    # Get all universities
    response = client.get("/api/v1/universities/")
    universities = response.json()
    
    # Filter for UNI1 and UNI2
    test_unis = [u for u in universities if u['code'] in ['UNI1', 'UNI2', 'UNI2_TEMP']]
    
    print("\n" + "="*70)
    print(" Test Universities Created")
    print("="*70)
    
    for uni in sorted(test_unis, key=lambda x: x['code']):
        status = "🔴 INACTIVE (TEMP)" if not uni.get('is_active', True) else "🟢 ACTIVE"
        print(f"\n{status}")
        print(f"  ID: {uni['id']}")
        print(f"  Name: {uni['name']}")
        print(f"  Code: {uni['code']}")
        print(f"  Schema: {uni['schema_name']}")
        
        # Get detailed info for active universities
        if uni.get('is_active', True):
            uni_id = uni['id']
            
            # Get faculties
            faculties_resp = client.get(f"/api/v1/universities/{uni_id}/faculties")
            faculties = faculties_resp.json() if faculties_resp.status_code == 200 else []
            
            # Get subjects
            subjects_count = 0
            for faculty in faculties:
                subjects_resp = client.get(f"/api/v1/universities/{uni_id}/faculties/{faculty['id']}/subjects")
                if subjects_resp.status_code == 200:
                    subjects_count += len(subjects_resp.json())
            
            print(f"\n  📚 Data Summary:")
            print(f"     Faculties: {len(faculties)}")
            print(f"     Subjects: {subjects_count}")
            print(f"     Lectures: ~{subjects_count * 3} (estimated)")
            
            if faculties:
                print(f"\n  📂 Faculties:")
                for fac in faculties:
                    print(f"     - {fac['name']} ({fac['code']})")
    
    # Check for backup and temp schema for UNI2
    uni2 = next((u for u in test_unis if u['code'] == 'UNI2'), None)
    if uni2:
        print("\n" + "="*70)
        print(" University 2 Backup & Temp Schema Status")
        print("="*70)
        
        # Check temp status
        temp_status_resp = client.get(f"/api/v1/backups/{uni2['id']}/temp-status")
        if temp_status_resp.status_code == 200:
            temp_status = temp_status_resp.json()
            if temp_status.get('has_temp_schema'):
                print(f"\n✅ Temporary schema exists: {temp_status['temp_schema_name']}")
                print(f"   Created from backup restore")
                print(f"   Registered as university ID: {temp_status.get('temp_university_id', 'N/A')}")
                print(f"\n   To promote temp to production:")
                print(f"   POST /api/v1/backups/{uni2['id']}/promote-temp")
            else:
                print("\n❌ No temporary schema found")
    
    print("\n" + "="*70)
    print(" Test User Credentials")
    print("="*70)
    print("\nFor University 1 (UNI1) and University 2 (UNI2):")
    print("\n  Admin users:")
    print("    admin.cs1@uni[1|2].edu / Admin123!")
    print("    admin.math1@uni[1|2].edu / Admin123!")
    print("    admin.eng1@uni[1|2].edu / Admin123!")
    print("\n  Professor users:")
    print("    prof1.cs1@uni[1|2].edu / Prof123!")
    print("    prof2.cs1@uni[1|2].edu / Prof123!")
    print("    (similar for math1, eng1)")
    print("\n  Student users:")
    print("    student1.cs1@uni[1|2].edu / Student123!")
    print("    student2.cs1@uni[1|2].edu / Student123!")
    print("    student3.cs1@uni[1|2].edu / Student123!")
    print("    (similar for math1, eng1)")
    
    print("\n" + "="*70 + "\n")
