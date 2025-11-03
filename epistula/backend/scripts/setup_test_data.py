#!/usr/bin/env python3
"""
Setup script to create two fully populated test universities.

University 1: Complete with all entities
University 2: Complete with all entities + a temporary university from backup

Run this script from the backend directory:
    python scripts/setup_test_data.py
"""

import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from utils.database import get_db
from middleware.auth import get_current_user

class DummyUser:
    """Dummy user for testing (simulates authenticated root user)"""
    def __init__(self, id: int, email: str, is_root: bool):
        self.id = id
        self.email = email
        self.is_root = is_root

def override_get_current_user():
    """Override to return root user"""
    return DummyUser(id=1, email="root@epistula.edu", is_root=True)

# Override the auth dependency
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

def create_university(name: str, code: str, description: str):
    """Create a university"""
    response = client.post("/api/v1/universities/", json={
        "name": name,
        "code": code,
        "description": description
    })
    if response.status_code == 201:
        print(f"✓ Created university: {name} (ID: {response.json()['id']})")
        return response.json()
    else:
        print(f"✗ Failed to create university {name}: {response.status_code} - {response.text}")
        return None

def create_faculty(uni_id: int, name: str, short_name: str, code: str):
    """Create a faculty"""
    response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": name,
        "short_name": short_name,
        "code": code,
        "description": f"{name} - Faculty of excellence"
    })
    if response.status_code == 201:
        print(f"  ✓ Created faculty: {name} (ID: {response.json()['id']})")
        return response.json()
    else:
        print(f"  ✗ Failed to create faculty {name}: {response.status_code} - {response.text}")
        return None

def create_subject(uni_id: int, faculty_id: int, name: str, code: str):
    """Create a subject"""
    response = client.post(f"/api/v1/subjects/{uni_id}/{faculty_id}", json={
        "name": name,
        "code": code,
        "description": f"{name} - Learn the fundamentals"
    })
    if response.status_code == 201:
        print(f"    ✓ Created subject: {name} (ID: {response.json()['id']})")
        return response.json()
    else:
        print(f"    ✗ Failed to create subject {name}: {response.status_code} - {response.text}")
        return None

def create_user(uni_id: int, email: str, name: str, password: str, role: str, faculty_id: int = None):
    """Create a user"""
    payload = {
        "email": email,
        "name": name,
        "password": password,
        "role": role
    }
    if faculty_id:
        payload["faculty_id"] = faculty_id
    
    response = client.post(f"/api/v1/universities/{uni_id}/users", json=payload)
    if response.status_code == 201:
        print(f"      ✓ Created {role}: {name} (ID: {response.json()['id']})")
        return response.json()
    else:
        print(f"      ✗ Failed to create {role} {name}: {response.status_code} - {response.text}")
        return None

def assign_professor_to_faculty(uni_id: int, faculty_id: int, professor_id: int):
    """Assign professor to faculty"""
    response = client.post(
        f"/api/v1/faculties/{uni_id}/{faculty_id}/professors",
        json={"professor_id": professor_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned professor {professor_id} to faculty {faculty_id}")
        return True
    else:
        print(f"      ✗ Failed to assign professor: {response.status_code} - {response.text}")
        return False

def assign_professor_to_subject(uni_id: int, faculty_id: int, subject_id: int, professor_id: int):
    """Assign professor to subject"""
    response = client.post(
        f"/api/v1/subjects/{uni_id}/{faculty_id}/{subject_id}/professors",
        json={"professor_id": professor_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned professor {professor_id} to subject {subject_id}")
        return True
    else:
        print(f"      ✗ Failed to assign professor to subject: {response.status_code} - {response.text}")
        return False

def assign_student_to_faculty(uni_id: int, faculty_id: int, student_id: int):
    """Assign student to faculty"""
    response = client.post(
        f"/api/v1/faculties/{uni_id}/{faculty_id}/students",
        json={"student_id": student_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned student {student_id} to faculty {faculty_id}")
        return True
    else:
        print(f"      ✗ Failed to assign student: {response.status_code} - {response.text}")
        return False

def assign_student_to_subject(uni_id: int, faculty_id: int, subject_id: int, student_id: int):
    """Assign student to subject"""
    response = client.post(
        f"/api/v1/subjects/{uni_id}/{faculty_id}/{subject_id}/students",
        json={"student_id": student_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned student {student_id} to subject {subject_id}")
        return True
    else:
        print(f"      ✗ Failed to assign student to subject: {response.status_code} - {response.text}")
        return False

def create_lecture(uni_id: int, faculty_id: int, subject_id: int, title: str, date: str, is_active: bool = True):
    """Create a lecture"""
    response = client.post(
        f"/api/v1/subjects/{uni_id}/{faculty_id}/{subject_id}/lectures",
        json={
            "title": title,
            "description": f"Lecture about {title}",
            "lecture_date": date,
            "is_active": is_active
        }
    )
    if response.status_code == 201:
        status = "published" if is_active else "draft"
        print(f"      ✓ Created lecture ({status}): {title}")
        return response.json()
    else:
        print(f"      ✗ Failed to create lecture: {response.status_code} - {response.text}")
        return None

def create_backup(uni_id: int, description: str):
    """Create a backup"""
    response = client.post(f"/api/v1/backups/{uni_id}/create")
    if response.status_code == 200:
        print(f"  ✓ Created backup: {description}")
        result = response.json()
        # Return backup name from filename
        if "filename" in result:
            result["backup_file"] = result["filename"]
        return result
    else:
        print(f"  ✗ Failed to create backup: {response.status_code} - {response.text}")
        return None

def restore_as_temp(uni_id: int, backup_name: str, description: str):
    """Restore backup as temporary university"""
    response = client.post(
        f"/api/v1/backups/{uni_id}/{backup_name}/restore",
        params={"to_temp": True}
    )
    if response.status_code == 200:
        print(f"  ✓ Restored as temporary university: {description}")
        return response.json()
    else:
        print(f"  ✗ Failed to restore as temp: {response.status_code} - {response.text}")
        return None

def populate_university(uni_num: int):
    """Populate a university with all entities"""
    print(f"\n{'='*70}")
    print(f"Creating University {uni_num}")
    print(f"{'='*70}")
    
    # Create university
    uni = create_university(
        name=f"Test University {uni_num}",
        code=f"UNI{uni_num}",
        description=f"Complete test university number {uni_num}"
    )
    if not uni:
        return None
    
    uni_id = uni["id"]
    
    # Create faculties
    faculties_info = [
        {"name": "Faculty of Computer Science", "short_name": "FCS", "code": f"FCS{uni_num}"},
        {"name": "Faculty of Mathematics", "short_name": "FM", "code": f"FM{uni_num}"},
        {"name": "Faculty of Engineering", "short_name": "FE", "code": f"FE{uni_num}"},
    ]
    
    faculty_data = []
    for fac_info in faculties_info:
        faculty = create_faculty(uni_id, fac_info["name"], fac_info["short_name"], fac_info["code"])
        if faculty:
            faculty_data.append(faculty)
    
    # For each faculty, create subjects, users, and lectures
    for idx, faculty in enumerate(faculty_data):
        faculty_id = faculty["id"]
        faculty_short = faculty["short_name"]
        
        # Create subjects
        subjects_info = [
            {"name": f"Introduction to {faculty_short}", "code": f"INTRO{uni_num}{idx}"},
            {"name": f"Advanced {faculty_short}", "code": f"ADV{uni_num}{idx}"},
        ]
        
        subject_data = []
        for subj_info in subjects_info:
            subject = create_subject(uni_id, faculty_id, subj_info["name"], subj_info["code"])
            if subject:
                subject_data.append(subject)
        
        # Create admin
        admin = create_user(
            uni_id,
            email=f"admin.{faculty_short.lower()}{uni_num}@uni{uni_num}.edu",
            name=f"{faculty['name']} Admin",
            password="Admin123!",
            role="uni_admin",
            faculty_id=faculty_id
        )
        
        # Create professors
        professors = []
        for i in range(2):
            prof = create_user(
                uni_id,
                email=f"prof{i+1}.{faculty_short.lower()}{uni_num}@uni{uni_num}.edu",
                name=f"{faculty_short} Professor {i+1}",
                password="Prof123!",
                role="professor",
                faculty_id=faculty_id
            )
            if prof:
                professors.append(prof)
                # Assign to faculty
                assign_professor_to_faculty(uni_id, faculty_id, prof["id"])
        
        # Create students
        students = []
        for i in range(3):
            student = create_user(
                uni_id,
                email=f"student{i+1}.{faculty_short.lower()}{uni_num}@uni{uni_num}.edu",
                name=f"{faculty_short} Student {i+1}",
                password="Student123!",
                role="student",
                faculty_id=faculty_id
            )
            if student:
                students.append(student)
                # Assign to faculty
                assign_student_to_faculty(uni_id, faculty_id, student["id"])
        
        # For each subject, assign professors, students, and create lectures
        for subj_idx, subject in enumerate(subject_data):
            subject_id = subject["id"]
            
            # Assign professor to subject (use modulo to distribute professors)
            if professors:
                prof = professors[subj_idx % len(professors)]
                assign_professor_to_subject(uni_id, faculty_id, subject_id, prof["id"])
            
            # Assign all students to all subjects
            for student in students:
                assign_student_to_subject(uni_id, faculty_id, subject_id, student["id"])
            
            # Create lectures
            base_date = datetime.now()
            lectures_info = [
                {"title": "Week 1: Introduction", "days": -7, "is_active": True},
                {"title": "Week 2: Fundamentals", "days": 0, "is_active": True},
                {"title": "Week 3: Advanced Topics", "days": 7, "is_active": False},
            ]
            
            for lec_info in lectures_info:
                lecture_date = (base_date + timedelta(days=lec_info["days"])).strftime("%Y-%m-%d")
                create_lecture(
                    uni_id, faculty_id, subject_id,
                    title=lec_info["title"],
                    date=lecture_date,
                    is_active=lec_info["is_active"]
                )
    
    return uni

def main():
    print("="*70)
    print(" TEST UNIVERSITIES SETUP SCRIPT")
    print("="*70)
    print("\nThis script creates two fully populated test universities:")
    print("  • University 1: Complete with all entities")
    print("  • University 2: Complete + temporary university from backup")
    print()
    
    # Create University 1
    uni1 = populate_university(1)
    if not uni1:
        print("\n✗ Failed to create University 1")
        sys.exit(1)
    
    # Create University 2
    uni2 = populate_university(2)
    if not uni2:
        print("\n✗ Failed to create University 2")
        sys.exit(1)
    
    # Create backup of University 2
    print(f"\n{'='*70}")
    print("Creating backup of University 2")
    print(f"{'='*70}")
    backup = create_backup(uni2["id"], "Test backup for temp university restoration")
    
    if backup and "backup_file" in backup:
        # Restore as temporary university
        print(f"\n{'='*70}")
        print("Restoring backup as temporary university")
        print(f"{'='*70}")
        temp_uni = restore_as_temp(
            uni2["id"],
            backup["backup_file"],
            "Temporary university from University 2 backup"
        )
        
        if temp_uni:
            print(f"\n✓ Successfully created temporary university schema: {temp_uni.get('schema_name', 'N/A')}")
    
    # Print summary
    print(f"\n{'='*70}")
    print(" SETUP COMPLETE!")
    print(f"{'='*70}")
    print(f"\nUniversity 1 (ID: {uni1['id']})")
    print(f"  • Name: {uni1['name']}")
    print(f"  • Code: {uni1['code']}")
    print(f"  • 3 Faculties × 2 Subjects each")
    print(f"  • 3 Admins (1 per faculty)")
    print(f"  • 6 Professors (2 per faculty)")
    print(f"  • 9 Students (3 per faculty)")
    print(f"  • 18 Lectures (3 per subject, 2 published + 1 draft)")
    
    print(f"\nUniversity 2 (ID: {uni2['id']})")
    print(f"  • Name: {uni2['name']}")
    print(f"  • Code: {uni2['code']}")
    print(f"  • 3 Faculties × 2 Subjects each")
    print(f"  • 3 Admins (1 per faculty)")
    print(f"  • 6 Professors (2 per faculty)")
    print(f"  • 9 Students (3 per faculty)")
    print(f"  • 18 Lectures (3 per subject, 2 published + 1 draft)")
    if backup:
        print(f"  • 1 Backup created")
        if temp_uni:
            print(f"  • 1 Temporary university restored from backup")
    
    print(f"\n{'='*70}")
    print("You can now test the system with fully populated data!")
    print(f"{'='*70}\n")

if __name__ == "__main__":
    main()
