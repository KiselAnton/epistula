#!/usr/bin/env python3
"""
Script to create two fully populated test universities:
- University 1: Complete with all entities
- University 2: Complete with all entities + a temporary university from backup
"""

import requests
import sys
from datetime import datetime, timedelta

# API base URL
BASE_URL = "http://localhost:8000/api/v1"

# Root credentials (match docker-compose defaults)
ROOT_EMAIL = "root@localhost.localdomain"
ROOT_PASSWORD = "changeme123"

def login(email: str, password: str):
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

def create_university(token: str, name: str, code: str, description: str):
    """Create a university"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/universities/", 
        headers=headers,
        json={
            "name": name,
            "code": code,
            "description": description
        }
    )
    if response.status_code == 201:
        print(f"✓ Created university: {name}")
        return response.json()
    else:
        print(f"✗ Failed to create university {name}: {response.status_code} - {response.text}")
        return None

def find_university(token: str, code: str):
    """Find an existing university by code"""
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/universities/", headers=headers)
    if r.status_code != 200:
        return None
    items = r.json()
    for u in items:
        if u.get("code") == code:
            return u
    return None

def create_faculty(token: str, uni_id: int, name: str, short_name: str, code: str):
    """Create a faculty"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/faculties/{uni_id}",
        headers=headers,
        json={
            "name": name,
            "short_name": short_name,
            "code": code,
            "description": f"{name} - Faculty of excellence"
        }
    )
    if response.status_code == 201:
        print(f"  ✓ Created faculty: {name}")
        return response.json()
    else:
        print(f"  ✗ Failed to create faculty {name}: {response.status_code} - {response.text}")
        return None

def create_subject(token: str, uni_id: int, faculty_id: int, name: str, code: str):
    """Create a subject"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/subjects/{uni_id}/{faculty_id}",
        headers=headers,
        json={
            "name": name,
            "code": code,
            "description": f"{name} - Learn the fundamentals"
        }
    )
    if response.status_code == 201:
        print(f"    ✓ Created subject: {name}")
        return response.json()
    else:
        print(f"    ✗ Failed to create subject {name}: {response.status_code} - {response.text}")
        return None

def create_user(token: str, uni_id: int, email: str, name: str, password: str, role: str, faculty_id: int = None):
    """Create a user"""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "email": email,
        "name": name,
        "password": password,
        "role": role
    }
    if faculty_id:
        payload["faculty_id"] = faculty_id
    
    response = requests.post(f"{BASE_URL}/universities/{uni_id}/users",
        headers=headers,
        json=payload
    )
    if response.status_code == 201:
        print(f"      ✓ Created {role}: {name}")
        return response.json()
    else:
        print(f"      ✗ Failed to create {role} {name}: {response.status_code} - {response.text}")
        return None

def assign_professor_to_faculty(token: str, uni_id: int, faculty_id: int, professor_id: int):
    """Assign professor to faculty"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/faculties/{uni_id}/{faculty_id}/professors",
        headers=headers,
        json={"professor_id": professor_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned professor to faculty")
        return response.json()
    else:
        print(f"      ✗ Failed to assign professor to faculty: {response.status_code} - {response.text}")
        return None

def assign_professor_to_subject(token: str, uni_id: int, faculty_id: int, subject_id: int, professor_id: int):
    """Assign professor to subject"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/subjects/{uni_id}/{faculty_id}/{subject_id}/professors",
        headers=headers,
        json={"professor_id": professor_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned professor to subject")
        return response.json()
    else:
        print(f"      ✗ Failed to assign professor to subject: {response.status_code} - {response.text}")
        return None

def assign_student_to_faculty(token: str, uni_id: int, faculty_id: int, student_id: int):
    """Assign student to faculty"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/faculties/{uni_id}/{faculty_id}/students",
        headers=headers,
        json={"student_id": student_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned student to faculty")
        return response.json()
    else:
        print(f"      ✗ Failed to assign student to faculty: {response.status_code} - {response.text}")
        return None

def assign_student_to_subject(token: str, uni_id: int, faculty_id: int, subject_id: int, student_id: int):
    """Assign student to subject"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/subjects/{uni_id}/{faculty_id}/{subject_id}/students",
        headers=headers,
        json={"student_id": student_id}
    )
    if response.status_code == 201:
        print(f"      ✓ Assigned student to subject")
        return response.json()
    else:
        print(f"      ✗ Failed to assign student to subject: {response.status_code} - {response.text}")
        return None

def create_lecture(token: str, uni_id: int, faculty_id: int, subject_id: int, title: str, date: str, is_active: bool = True):
    """Create a lecture"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/subjects/{uni_id}/{faculty_id}/{subject_id}/lectures",
        headers=headers,
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
        print(f"      ✗ Failed to create lecture {title}: {response.status_code} - {response.text}")
        return None

def create_lecture_note(student_token: str, uni_id: int, faculty_id: int, subject_id: int, lecture_id: int, content: str):
    """Create or update a private lecture note for the student."""
    headers = {"Authorization": f"Bearer {student_token}"}
    response = requests.post(
        f"{BASE_URL}/subjects/{uni_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}/notes",
        headers=headers,
        json={"content": content}
    )
    if response.status_code in (200, 201):
        print(f"        ✓ Added note for lecture {lecture_id}")
        return response.json()
    else:
        print(f"        ✗ Failed to add note for lecture {lecture_id}: {response.status_code} - {response.text}")
        return None

def create_backup(token: str, uni_id: int, description: str):
    """Create a backup using current backups API and set metadata."""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/backups/{uni_id}/create", headers=headers)
    if response.status_code == 200:
        print(f"  ✓ Created backup for university {uni_id}")
        data = response.json()
        filename = data.get("filename")
        if filename:
            try:
                requests.put(
                    f"{BASE_URL}/backups/{uni_id}/{filename}/meta",
                    headers=headers,
                    json={"title": "Seed backup", "description": description}
                )
            except Exception:
                pass
        return data
    else:
        print(f"  ✗ Failed to create backup: {response.status_code} - {response.text}")
        return None

def restore_as_temp(token: str, uni_id: int, backup_file: str, description: str):
    """Restore backup as temporary university using current API."""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/backups/{uni_id}/{backup_file}/restore",
        headers=headers,
        params={"to_temp": "true"}
    )
    if response.status_code == 200:
        print(f"  ✓ Restored as temporary university: {description}")
        return response.json()
    else:
        print(f"  ✗ Failed to restore as temp: {response.status_code} - {response.text}")
        return None

def populate_university(token: str, uni_num: int):
    """Populate a university with all entities"""
    print(f"\n{'='*60}")
    print(f"Creating University {uni_num}")
    print(f"{'='*60}")
    
    # Create or reuse university
    code = f"UNI{uni_num}"
    uni = find_university(token, code)
    if uni:
        print(f"✓ Using existing university: {uni['name']} ({code})")
    else:
        uni = create_university(
            token,
            name=f"Test University {uni_num}",
            code=code,
            description=f"Complete test university number {uni_num}"
        )
    if not uni:
        return None
    
    uni_id = uni["id"]
    
    # Create faculties
    faculties = [
        {"name": "Faculty of Computer Science", "short_name": "FCS", "code": f"FCS{uni_num}"},
        {"name": "Faculty of Mathematics", "short_name": "FM", "code": f"FM{uni_num}"},
        {"name": "Faculty of Engineering", "short_name": "FE", "code": f"FE{uni_num}"},
    ]
    
    faculty_data = []
    for fac in faculties:
        faculty = create_faculty(token, uni_id, fac["name"], fac["short_name"], fac["code"])
        if faculty:
            faculty_data.append(faculty)
    
    # For each faculty, create subjects, users, and lectures
    for idx, faculty in enumerate(faculty_data):
        faculty_id = faculty["id"]
        faculty_name = faculty["name"]
        
        # Create subjects
        subjects = [
            {"name": f"Introduction to {faculty['short_name']}", "code": f"INTRO{uni_num}{idx}"},
            {"name": f"Advanced {faculty['short_name']}", "code": f"ADV{uni_num}{idx}"},
        ]
        
        subject_data = []
        for subj in subjects:
            subject = create_subject(token, uni_id, faculty_id, subj["name"], subj["code"])
            if subject:
                subject_data.append(subject)
        
        # Create admin
        admin = create_user(
            token, uni_id,
            email=f"admin.{faculty['short_name'].lower()}{uni_num}@uni{uni_num}.edu",
            name=f"{faculty_name} Admin",
            password="Admin123!",
            role="uni_admin",
            faculty_id=faculty_id
        )
        
        # Create professors
        professors = []
        for i in range(2):
            prof = create_user(
                token, uni_id,
                email=f"prof{i+1}.{faculty['short_name'].lower()}{uni_num}@uni{uni_num}.edu",
                name=f"{faculty_name} Professor {i+1}",
                password="Prof123!",
                role="professor",
                faculty_id=faculty_id
            )
            if prof:
                professors.append(prof)
                # Assign to faculty
                assign_professor_to_faculty(token, uni_id, faculty_id, prof["id"])
        
        # Create students
        students = []
        for i in range(3):
            student = create_user(
                token, uni_id,
                email=f"student{i+1}.{faculty['short_name'].lower()}{uni_num}@uni{uni_num}.edu",
                name=f"{faculty_name} Student {i+1}",
                password="Student123!",
                role="student",
                faculty_id=faculty_id
            )
            if student:
                students.append(student)
                # Assign to faculty
                assign_student_to_faculty(token, uni_id, faculty_id, student["id"])
        
        # For each subject, assign professors, students, and create lectures
        for subj_idx, subject in enumerate(subject_data):
            subject_id = subject["id"]
            
            # Assign professor to subject (use modulo to distribute professors)
            if professors:
                prof = professors[subj_idx % len(professors)]
                assign_professor_to_subject(token, uni_id, faculty_id, subject_id, prof["id"])
            
            # Assign all students to all subjects
            for student in students:
                assign_student_to_subject(token, uni_id, faculty_id, subject_id, student["id"])
            
            # Create lectures
            base_date = datetime.now()
            lectures = [
                {"title": "Week 1: Introduction", "days": -7, "is_active": True},
                {"title": "Week 2: Fundamentals", "days": 0, "is_active": True},
                {"title": "Week 3: Advanced Topics", "days": 7, "is_active": False},
            ]
            
            created_lectures = []
            for lec in lectures:
                lecture_date = (base_date + timedelta(days=lec["days"])).strftime("%Y-%m-%d")
                lec_obj = create_lecture(
                    token, uni_id, faculty_id, subject_id,
                    title=lec["title"],
                    date=lecture_date,
                    is_active=lec["is_active"]
                )
                if lec_obj:
                    created_lectures.append(lec_obj)

            # For each student, add a couple of private notes to the first two lectures
            for student in students:
                s_token = login(student["email"], "Student123!")
                if not s_token:
                    continue
                for lect in created_lectures[:2]:
                    create_lecture_note(
                        s_token, uni_id, faculty_id, subject_id, lect["id"],
                        content=f"Notes by {student['name']} for {lect['title']}"
                    )
    
    return uni

def main():
    print("Starting test university creation...")
    print("Authenticating as root...")

    token = login(ROOT_EMAIL, ROOT_PASSWORD)
    if not token:
        print("Failed to authenticate. Check backend is running and credentials match docker-compose.")
        sys.exit(1)

    # Create and populate UNI1
    uni1 = populate_university(token, 1)
    if not uni1:
        print("Failed to setup UNI1")

    # Create and populate UNI2
    uni2 = populate_university(token, 2)
    if not uni2:
        print("Failed to setup UNI2")

    # Optionally create a backup for UNI2 and restore as temp (comment out if not needed)
    try:
        if uni2:
            backup = create_backup(token, uni2["id"], "Seed backup for UNI2")
            filename = backup.get("filename") if backup else None
            if filename:
                restore_as_temp(token, uni2["id"], filename, "Temporary UNI2 from backup")
    except Exception as e:
        print(f"Skipping backup/restore: {e}")

    print("\nDone. You can verify with: python scripts/show_test_universities.py")

if __name__ == "__main__":
    main()
