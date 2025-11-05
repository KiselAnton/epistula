#!/usr/bin/env python3
"""
Shared helpers and constants for test university scripts.
Reduces code duplication and makes maintenance easier.
"""

import os
import requests
from typing import Optional, Dict, Any

# API Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
ROOT_EMAIL = os.getenv("ROOT_EMAIL", "root@localhost.localdomain")
ROOT_PASSWORD = os.getenv("ROOT_PASSWORD", "changeme123")

# Test University Configuration
TEST_UNIVERSITY_CODES = ["UNI1", "UNI2"]
TEST_UNIVERSITY_NAMES = {
    "UNI1": "Test University 1",
    "UNI2": "Test University 2"
}

# Test Faculty Configuration
FACULTIES = [
    {"name": "Faculty of Computer Science", "short_name": "FCS", "code_suffix": ""},
    {"name": "Faculty of Mathematics", "short_name": "FM", "code_suffix": ""},
    {"name": "Faculty of Engineering", "short_name": "FE", "code_suffix": ""},
]

# Test Subject Configuration
SUBJECTS_PER_FACULTY = 2  # Number of subjects per faculty
PROFESSORS_PER_FACULTY = 2
STUDENTS_PER_FACULTY = 3

# User password defaults
DEFAULT_ADMIN_PASSWORD = "Admin123!"
DEFAULT_PROFESSOR_PASSWORD = "Prof123!"
DEFAULT_STUDENT_PASSWORD = "Student123!"


def login(email: str, password: str) -> Optional[str]:
    """Login and get auth token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Login error: {e}")
    return None


def api_request(
    method: str,
    endpoint: str,
    token: str,
    json_data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 15
) -> Optional[requests.Response]:
    """Generic API request helper"""
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    
    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=json_data,
            params=params,
            timeout=timeout
        )
        return response
    except Exception as e:
        print(f"API request error ({method} {endpoint}): {e}")
        return None


def get_universities(token: str) -> list:
    """Get all universities"""
    response = api_request("GET", "/universities/", token)
    if response and response.status_code == 200:
        return response.json()
    return []


def find_university_by_code(token: str, code: str) -> Optional[Dict[str, Any]]:
    """Find a university by code"""
    universities = get_universities(token)
    for uni in universities:
        if uni.get("code") == code:
            return uni
    return None


def create_university(token: str, name: str, code: str, description: str) -> Optional[Dict[str, Any]]:
    """Create a university"""
    response = api_request(
        "POST",
        "/universities/",
        token,
        json_data={
            "name": name,
            "code": code,
            "description": description
        }
    )
    if response and response.status_code == 201:
        print(f"✓ Created university: {name}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"✗ Failed to create university {name}: {error_msg}")
        return None


def create_faculty(
    token: str,
    uni_id: int,
    name: str,
    short_name: str,
    code: str
) -> Optional[Dict[str, Any]]:
    """Create a faculty"""
    response = api_request(
        "POST",
        f"/faculties/{uni_id}",
        token,
        json_data={
            "name": name,
            "short_name": short_name,
            "code": code,
            "description": f"{name} - Faculty of excellence"
        }
    )
    if response and response.status_code == 201:
        print(f"  ✓ Created faculty: {name}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"  ✗ Failed to create faculty {name}: {error_msg}")
        return None


def create_subject(
    token: str,
    uni_id: int,
    faculty_id: int,
    name: str,
    code: str
) -> Optional[Dict[str, Any]]:
    """Create a subject"""
    response = api_request(
        "POST",
        f"/subjects/{uni_id}/{faculty_id}",
        token,
        json_data={
            "name": name,
            "code": code,
            "description": f"{name} - Learn the fundamentals"
        }
    )
    if response and response.status_code == 201:
        print(f"    ✓ Created subject: {name}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"    ✗ Failed to create subject {name}: {error_msg}")
        return None


def create_user(
    token: str,
    uni_id: int,
    email: str,
    name: str,
    password: str,
    role: str,
    faculty_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """Create a user"""
    payload = {
        "email": email,
        "name": name,
        "password": password,
        "role": role
    }
    if faculty_id:
        payload["faculty_id"] = faculty_id
    
    response = api_request(
        "POST",
        f"/universities/{uni_id}/users",
        token,
        json_data=payload
    )
    if response and response.status_code == 201:
        print(f"      ✓ Created {role}: {name}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"      ✗ Failed to create {role} {name}: {error_msg}")
        return None


def assign_professor_to_faculty(
    token: str,
    uni_id: int,
    faculty_id: int,
    professor_id: int
) -> Optional[Dict[str, Any]]:
    """Assign professor to faculty"""
    response = api_request(
        "POST",
        f"/faculties/{uni_id}/{faculty_id}/professors",
        token,
        json_data={"professor_id": professor_id}
    )
    if response and response.status_code == 201:
        print(f"      ✓ Assigned professor to faculty")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"      ✗ Failed to assign professor to faculty: {error_msg}")
        return None


def assign_professor_to_subject(
    token: str,
    uni_id: int,
    faculty_id: int,
    subject_id: int,
    professor_id: int
) -> Optional[Dict[str, Any]]:
    """Assign professor to subject"""
    response = api_request(
        "POST",
        f"/subjects/{uni_id}/{faculty_id}/{subject_id}/professors",
        token,
        json_data={"professor_id": professor_id}
    )
    if response and response.status_code == 201:
        print(f"      ✓ Assigned professor to subject")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"      ✗ Failed to assign professor to subject: {error_msg}")
        return None


def assign_student_to_faculty(
    token: str,
    uni_id: int,
    faculty_id: int,
    student_id: int
) -> Optional[Dict[str, Any]]:
    """Assign student to faculty"""
    response = api_request(
        "POST",
        f"/faculties/{uni_id}/{faculty_id}/students",
        token,
        json_data={"student_id": student_id}
    )
    if response and response.status_code == 201:
        print(f"      ✓ Assigned student to faculty")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"      ✗ Failed to assign student to faculty: {error_msg}")
        return None


def assign_student_to_subject(
    token: str,
    uni_id: int,
    faculty_id: int,
    subject_id: int,
    student_id: int
) -> Optional[Dict[str, Any]]:
    """Assign student to subject"""
    response = api_request(
        "POST",
        f"/subjects/{uni_id}/{faculty_id}/{subject_id}/students",
        token,
        json_data={"student_id": student_id}
    )
    if response and response.status_code == 201:
        print(f"      ✓ Assigned student to subject")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"      ✗ Failed to assign student to subject: {error_msg}")
        return None


def create_lecture(
    token: str,
    uni_id: int,
    faculty_id: int,
    subject_id: int,
    title: str,
    date: str,
    is_active: bool = True
) -> Optional[Dict[str, Any]]:
    """Create a lecture"""
    response = api_request(
        "POST",
        f"/subjects/{uni_id}/{faculty_id}/{subject_id}/lectures",
        token,
        json_data={
            "title": title,
            "description": f"Lecture about {title}",
            "lecture_date": date,
            "is_active": is_active
        }
    )
    if response and response.status_code == 201:
        status = "published" if is_active else "draft"
        print(f"      ✓ Created lecture ({status}): {title}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"      ✗ Failed to create lecture {title}: {error_msg}")
        return None


def create_lecture_note(
    student_token: str,
    uni_id: int,
    faculty_id: int,
    subject_id: int,
    lecture_id: int,
    content: str
) -> Optional[Dict[str, Any]]:
    """Create or update a private lecture note for a student"""
    response = api_request(
        "POST",
        f"/subjects/{uni_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}/notes",
        student_token,
        json_data={"content": content}
    )
    if response and response.status_code in (200, 201):
        print(f"        ✓ Added note for lecture {lecture_id}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"        ✗ Failed to add note for lecture {lecture_id}: {error_msg}")
        return None


def create_backup(token: str, uni_id: int, description: str) -> Optional[Dict[str, Any]]:
    """Create a backup and set metadata"""
    response = api_request("POST", f"/backups/{uni_id}/create", token)
    if response and response.status_code == 200:
        print(f"  ✓ Created backup for university {uni_id}")
        data = response.json()
        filename = data.get("filename")
        if filename:
            try:
                api_request(
                    "PUT",
                    f"/backups/{uni_id}/{filename}/meta",
                    token,
                    json_data={"title": "Seed backup", "description": description}
                )
            except Exception:
                pass
        return data
    else:
        error_msg = response.text if response else "No response"
        print(f"  ✗ Failed to create backup: {error_msg}")
        return None


def restore_as_temp(
    token: str,
    uni_id: int,
    backup_file: str,
    description: str
) -> Optional[Dict[str, Any]]:
    """Restore backup as temporary university"""
    response = api_request(
        "POST",
        f"/backups/{uni_id}/{backup_file}/restore",
        token,
        params={"to_temp": "true"}
    )
    if response and response.status_code == 200:
        print(f"  ✓ Restored as temporary university: {description}")
        return response.json()
    else:
        error_msg = response.text if response else "No response"
        print(f"  ✗ Failed to restore as temp: {error_msg}")
        return None


def get_faculties(token: str, uni_id: int) -> list:
    """Get all faculties for a university"""
    response = api_request("GET", f"/faculties/{uni_id}", token)
    if response and response.status_code == 200:
        return response.json()
    return []


def get_subjects(token: str, uni_id: int, faculty_id: int) -> list:
    """Get all subjects for a faculty"""
    response = api_request("GET", f"/subjects/{uni_id}/{faculty_id}", token)
    if response and response.status_code == 200:
        return response.json()
    return []


def get_temp_status(token: str, uni_id: int) -> Optional[Dict[str, Any]]:
    """Get temporary schema status for a university"""
    response = api_request("GET", f"/backups/{uni_id}/temp-status", token)
    if response and response.status_code == 200:
        return response.json()
    return None
