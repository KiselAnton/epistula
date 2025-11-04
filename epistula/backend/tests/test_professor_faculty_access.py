"""
Tests for professor faculty/subject access control.

Verifies that professors can only see faculties and subjects they're assigned to.
"""
import pytest
import time
import random
from .test_utils import DummyUser


def test_professor_sees_only_assigned_faculties(client, set_user):
    """Professor should only see faculties they're assigned to, not all faculties."""
    # Create as root
    set_user(DummyUser(id=1, email="root@epistula.edu", is_root=True))
    
    unique_code = f"FAC{int(time.time() * 1000) % 1000000}{random.randint(0, 999)}"
    
    # Create university
    uni_response = client.post("/api/v1/universities/", json={
        "name": f"Test University {unique_code}",
        "code": unique_code,
        "description": "For faculty access testing"
    })
    assert uni_response.status_code == 201
    uni_id = uni_response.json()["id"]
    
    # Create two faculties
    faculty1_response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": "Faculty of Science",
        "short_name": "Science",
        "code": f"SCI{random.randint(0, 999)}"
    })
    assert faculty1_response.status_code == 201
    faculty1_id = faculty1_response.json()["id"]
    
    faculty2_response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": "Faculty of Arts",
        "short_name": "Arts",
        "code": f"ART{random.randint(0, 999)}"
    })
    assert faculty2_response.status_code == 201
    faculty2_id = faculty2_response.json()["id"]
    
    # Create professor user
    prof_response = client.post(f"/api/v1/universities/{uni_id}/users", json={
        "email": f"prof_{unique_code}@test.edu",
        "name": "Test Professor",
        "password": "password123",
        "role": "professor"
    })
    assert prof_response.status_code == 201
    prof_id = prof_response.json()["id"]
    
    # Assign professor ONLY to faculty1
    assign_response = client.post(
        f"/api/v1/faculties/{uni_id}/{faculty1_id}/professors",
        json={"professor_id": prof_id}
    )
    assert assign_response.status_code == 201
    
    # Now act as professor
    set_user(DummyUser(id=prof_id, email=f"prof_{unique_code}@test.edu", is_root=False))
    
    # List faculties as professor
    list_response = client.get(f"/api/v1/faculties/{uni_id}")
    assert list_response.status_code == 200
    
    faculties = list_response.json()
    faculty_ids = [f["id"] for f in faculties]
    
    # Should only see faculty1, not faculty2
    assert faculty1_id in faculty_ids, "Professor should see assigned faculty"
    assert faculty2_id not in faculty_ids, "Professor should NOT see unassigned faculty"


def test_professor_sees_only_assigned_subjects(client, set_user):
    """Professor should only see subjects in faculties they're assigned to."""
    # Create as root
    set_user(DummyUser(id=1, email="root@epistula.edu", is_root=True))
    
    unique_code = f"SUBJ{int(time.time() * 1000) % 1000000}{random.randint(0, 999)}"
    
    # Create university
    uni_response = client.post("/api/v1/universities/", json={
        "name": f"Test University {unique_code}",
        "code": unique_code,
        "description": "For subject access testing"
    })
    assert uni_response.status_code == 201
    uni_id = uni_response.json()["id"]
    
    # Create two faculties
    faculty1_response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": "Faculty of Science",
        "short_name": "Science",
        "code": f"SCI{random.randint(0, 999)}"
    })
    assert faculty1_response.status_code == 201
    faculty1_id = faculty1_response.json()["id"]
    
    faculty2_response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": "Faculty of Arts",
        "short_name": "Arts",
        "code": f"ART{random.randint(0, 999)}"
    })
    assert faculty2_response.status_code == 201
    faculty2_id = faculty2_response.json()["id"]
    
    # Create subject in faculty1
    subject1_response = client.post(f"/api/v1/subjects/{uni_id}/{faculty1_id}", json={
        "name": "Physics 101",
        "code": f"PHYS{random.randint(0, 999)}"
    })
    assert subject1_response.status_code == 201
    subject1_id = subject1_response.json()["id"]
    
    # Create subject in faculty2
    subject2_response = client.post(f"/api/v1/subjects/{uni_id}/{faculty2_id}", json={
        "name": "Literature 101",
        "code": f"LIT{random.randint(0, 999)}"
    })
    assert subject2_response.status_code == 201
    subject2_id = subject2_response.json()["id"]
    
    # Create professor user
    prof_response = client.post(f"/api/v1/universities/{uni_id}/users", json={
        "email": f"prof_{unique_code}@test.edu",
        "name": "Test Professor",
        "password": "password123",
        "role": "professor"
    })
    assert prof_response.status_code == 201
    prof_id = prof_response.json()["id"]
    
    # Assign professor ONLY to faculty1
    assign_response = client.post(
        f"/api/v1/faculties/{uni_id}/{faculty1_id}/professors",
        json={"professor_id": prof_id}
    )
    assert assign_response.status_code == 201
    
    # Now act as professor
    set_user(DummyUser(id=prof_id, email=f"prof_{unique_code}@test.edu", is_root=False))
    
    # List subjects in faculty1 - should work
    list1_response = client.get(f"/api/v1/subjects/{uni_id}/{faculty1_id}")
    assert list1_response.status_code == 200
    subjects1 = list1_response.json()
    subject1_ids = [s["id"] for s in subjects1]
    assert subject1_id in subject1_ids, "Professor should see subjects in assigned faculty"
    
    # List subjects in faculty2 - should return empty (no access)
    list2_response = client.get(f"/api/v1/subjects/{uni_id}/{faculty2_id}")
    assert list2_response.status_code == 200
    subjects2 = list2_response.json()
    assert len(subjects2) == 0, "Professor should NOT see subjects in unassigned faculty"


def test_professor_cannot_access_lectures_in_unassigned_faculty(client, set_user):
    """Professor should get 403 when trying to access lectures in unassigned faculty."""
    # Create as root
    set_user(DummyUser(id=1, email="root@epistula.edu", is_root=True))
    
    unique_code = f"LEC{int(time.time() * 1000) % 1000000}{random.randint(0, 999)}"
    
    # Create university
    uni_response = client.post("/api/v1/universities/", json={
        "name": f"Test University {unique_code}",
        "code": unique_code,
        "description": "For lecture access testing"
    })
    assert uni_response.status_code == 201
    uni_id = uni_response.json()["id"]
    
    # Create faculty
    faculty_response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": "Faculty of Science",
        "short_name": "Science",
        "code": f"SCI{random.randint(0, 999)}"
    })
    assert faculty_response.status_code == 201
    faculty_id = faculty_response.json()["id"]
    
    # Create subject
    subject_response = client.post(f"/api/v1/subjects/{uni_id}/{faculty_id}", json={
        "name": "Physics 101",
        "code": f"PHYS{random.randint(0, 999)}"
    })
    assert subject_response.status_code == 201
    subject_id = subject_response.json()["id"]
    
    # Create professor user (NOT assigned to this faculty)
    prof_response = client.post(f"/api/v1/universities/{uni_id}/users", json={
        "email": f"prof_{unique_code}@test.edu",
        "name": "Test Professor",
        "password": "password123",
        "role": "professor"
    })
    assert prof_response.status_code == 201
    prof_id = prof_response.json()["id"]
    
    # Now act as professor (without assignment)
    set_user(DummyUser(id=prof_id, email=f"prof_{unique_code}@test.edu", is_root=False))
    
    # Try to list lectures - should get 403
    lectures_response = client.get(f"/api/v1/subjects/{uni_id}/{faculty_id}/{subject_id}/lectures")
    assert lectures_response.status_code == 403, "Professor without faculty access should get 403"
