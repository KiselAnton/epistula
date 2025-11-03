"""
Comprehensive tests for uni_admin role permissions and functionality.

Tests cover:
- University management (view own only, no create/delete)
- Faculty CRUD operations  
- Subject CRUD operations  
- Lecture management
- User management within university
- Student/professor assignments
- File uploads

NOTE: Complex integration tests with database mocking are currently skipped
due to SQLAlchemy ORM incompatibility with partial mocking. See ROLE_TESTING.md
for recommended approaches (full integration tests vs unit tests).
"""
import pytest
import time
import random
from fastapi.testclient import TestClient
from .test_utils import DummyUser


# ============================================================================
# HELPER FUNCTION FOR E2E TESTS
# ============================================================================

def setup_admin_with_university(client, set_user):
    """
    Creates a full test environment: university + faculty + subject + admin user.
    
    Returns dict with: uni_id, faculty_id, subject_id, admin_id, unique_code
    """
    # Generate unique code to avoid conflicts
    unique_code = f"ADM{int(time.time() * 1000) % 1000000}{random.randint(0, 999)}"
    
    # Create university as root
    set_user(DummyUser(id=1, email="root@example.com", is_root=True))
    
    uni_response = client.post("/api/v1/universities/", json={
        "name": f"Test University {unique_code}",
        "code": unique_code,
        "description": "For admin testing"
    })
    assert uni_response.status_code == 201
    uni_id = uni_response.json()["id"]
    
    # Create faculty
    faculty_code = f"TF{random.randint(100, 999)}"
    fac_response = client.post(f"/api/v1/faculties/{uni_id}", json={
        "name": "Test Faculty",
        "short_name": "TF",
        "code": faculty_code
    })
    assert fac_response.status_code == 201
    faculty_id = fac_response.json()["id"]
    
    # Create subject
    subj_code = f"SUBJ{random.randint(100, 999)}"
    subj_response = client.post(f"/api/v1/subjects/{uni_id}/{faculty_id}", json={
        "name": "Test Subject",
        "code": subj_code
    })
    assert subj_response.status_code == 201
    subject_id = subj_response.json()["id"]
    
    # Create admin user
    admin_response = client.post(f"/api/v1/universities/{uni_id}/users", json={
        "email": f"admin_{unique_code}@test.edu",
        "password": "AdminPass123!",
        "name": "Test Admin",
        "role": "uni_admin",
        "faculty_id": faculty_id
    })
    assert admin_response.status_code == 201
    admin_id = admin_response.json()["id"]
    
    return {
        "uni_id": uni_id,
        "faculty_id": faculty_id,
        "subject_id": subject_id,
        "admin_id": admin_id,
        "unique_code": unique_code
    }


# ============================================================================
# SIMPLE PERMISSION TESTS (PASSING)
# ============================================================================


def test_admin_cannot_create_university(client, set_user):
    """Uni admin cannot create universities (root only)."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    response = client.post("/api/v1/universities/", json={
        "name": "New University",
        "code": "NEWUNI"
    })
    
    # Should get 403 Forbidden
    assert response.status_code == 403


def test_admin_cannot_delete_university(client, set_user):
    """Uni admin cannot delete universities (root only)."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    response = client.delete("/api/v1/universities/1")
    
    # Should get 403 Forbidden
    assert response.status_code == 403


def test_admin_can_upload_files(client, set_user):
    """Uni admin can upload files to storage."""
    from io import BytesIO
    from unittest.mock import patch
    
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    file_content = b"test file content"
    files = {"file": ("document.pdf", BytesIO(file_content), "application/pdf")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        mock_upload.return_value = "/storage/uploads/2025/11/doc123.pdf"
        
        response = client.post("/storage/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "/storage/" in data["url"]


# ============================================================================
# COMPLEX INTEGRATION TESTS (SKIPPED - NEEDS REFACTORING)
# These tests require either:
# 1. Full integration tests with real database
# 2. Complete ORM query mocking (not just session)
# 3. Refactoring endpoints to be more testable
# ============================================================================


def test_admin_can_view_own_university(client, set_user):
    """Uni admin can view their assigned university."""
    setup = setup_admin_with_university(client, set_user)
    
    # Switch to admin user
    set_user(DummyUser(id=setup["admin_id"], email=f"admin_{setup['unique_code']}@test.edu", is_root=False))
    
    # Admin should see their university when listing
    response = client.get("/api/v1/universities/")
    assert response.status_code == 200
    data = response.json()
    
    # Should see at least their own university
    uni_ids = [u["id"] for u in data]
    assert setup["uni_id"] in uni_ids, "Admin should see their own university"
    
    # Find their university in the list
    their_uni = next((u for u in data if u["id"] == setup["uni_id"]), None)
    assert their_uni is not None
    assert their_uni["code"] == setup["unique_code"]


def test_admin_cannot_create_university(client, set_user):
    """Uni admin cannot create universities (root only)."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    response = client.post("/api/v1/universities/", json={
        "name": "New University",
        "code": "NEWUNI"
    })
    
    # Should get 403 Forbidden
    assert response.status_code == 403


def test_admin_cannot_delete_university(client, set_user):
    """Uni admin cannot delete universities (root only)."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    response = client.delete("/api/v1/universities/1")
    
    # Should get 403 Forbidden
    assert response.status_code == 403


def test_admin_can_create_faculty(client, set_user):
    """Uni admin can create faculties in their university."""
    setup = setup_admin_with_university(client, set_user)
    
    # Switch to admin user
    set_user(DummyUser(id=setup["admin_id"], email=f"admin_{setup['unique_code']}@test.edu", is_root=False))
    
    # Create a new faculty in their university
    fac_code = f"NEWFAC{random.randint(100, 999)}"
    response = client.post(f"/api/v1/faculties/{setup['uni_id']}", json={
        "name": "New Faculty",
        "short_name": "NF",
        "code": fac_code
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == fac_code
    assert data["name"] == "New Faculty"


def test_admin_cannot_manage_other_university(client, set_user):
    """Uni admin cannot manage faculties in other universities."""
    # Create first university with admin
    setup1 = setup_admin_with_university(client, set_user)
    
    # Create second university (as root)
    set_user(DummyUser(id=1, email="root@example.com", is_root=True))
    unique_code2 = f"UNI{int(time.time() * 1000) % 1000000}{random.randint(0, 999)}"
    uni2_response = client.post("/api/v1/universities/", json={
        "name": f"Other University {unique_code2}",
        "code": unique_code2
    })
    assert uni2_response.status_code == 201
    uni2_id = uni2_response.json()["id"]
    
    # Switch to admin from first university
    set_user(DummyUser(id=setup1["admin_id"], email=f"admin_{setup1['unique_code']}@test.edu", is_root=False))
    
    # Try to create faculty in second university (should be forbidden)
    response = client.post(f"/api/v1/faculties/{uni2_id}", json={
        "name": "Forbidden Faculty",
        "short_name": "FF",
        "code": "FORBID123"
    })
    
    assert response.status_code == 403, "Admin should not be able to manage other universities"


def test_admin_can_create_users(client, set_user):
    """Uni admin can create users in their university."""
    setup = setup_admin_with_university(client, set_user)
    
    # Switch to admin user
    set_user(DummyUser(id=setup["admin_id"], email=f"admin_{setup['unique_code']}@test.edu", is_root=False))
    
    # Create a professor user in their university
    prof_email = f"professor_{int(time.time() * 1000) % 1000000}@test.edu"
    response = client.post(f"/api/v1/universities/{setup['uni_id']}/users", json={
        "email": prof_email,
        "name": "Test Professor",
        "password": "ProfPass123!",
        "role": "professor",
        "faculty_id": setup["faculty_id"]
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == prof_email
    assert data["role"] == "professor"


def test_admin_can_upload_files(client, set_user):
    """Uni admin can upload files to storage."""
    from io import BytesIO
    from unittest.mock import patch
    
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    file_content = b"test file content"
    files = {"file": ("document.pdf", BytesIO(file_content), "application/pdf")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        mock_upload.return_value = "/storage/uploads/2025/11/doc123.pdf"
        
        response = client.post("/storage/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "/storage/" in data["url"]


def test_admin_can_assign_professors_to_subjects(client, set_user):
    """Uni admin can assign professors to subjects."""
    setup = setup_admin_with_university(client, set_user)
    
    # Create a professor as root
    set_user(DummyUser(id=1, email="root@example.com", is_root=True))
    prof_email = f"professor_{int(time.time() * 1000) % 1000000}@test.edu"
    prof_response = client.post(f"/api/v1/universities/{setup['uni_id']}/users", json={
        "email": prof_email,
        "name": "Test Professor",
        "password": "ProfPass123!",
        "role": "professor",
        "faculty_id": setup["faculty_id"]
    })
    assert prof_response.status_code == 201
    prof_id = prof_response.json()["id"]
    
    # Assign professor to faculty first (required before assigning to subject)
    faculty_assign = client.post(
        f"/api/v1/faculties/{setup['uni_id']}/{setup['faculty_id']}/professors",
        json={"professor_id": prof_id}
    )
    assert faculty_assign.status_code == 201
    
    # Switch to admin user
    set_user(DummyUser(id=setup["admin_id"], email=f"admin_{setup['unique_code']}@test.edu", is_root=False))
    
    # Assign professor to subject
    response = client.post(
        f"/api/v1/subjects/{setup['uni_id']}/{setup['faculty_id']}/{setup['subject_id']}/professors",
        json={"professor_id": prof_id}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["professor_id"] == prof_id
    assert "assigned_at" in data


def test_admin_can_view_lectures(client, set_user):
    """Uni admin can view all lectures (published and unpublished) in their university."""
    setup = setup_admin_with_university(client, set_user)
    
    # Create lectures as root - one published, one unpublished
    set_user(DummyUser(id=1, email="root@example.com", is_root=True))
    
    # Create published lecture
    pub_response = client.post(
        f"/api/v1/subjects/{setup['uni_id']}/{setup['faculty_id']}/{setup['subject_id']}/lectures",
        json={"title": "Published Lecture", "description": "Public"}
    )
    assert pub_response.status_code == 201
    pub_id = pub_response.json()["id"]
    
    # Publish it
    client.patch(
        f"/api/v1/subjects/{setup['uni_id']}/{setup['faculty_id']}/{setup['subject_id']}/lectures/{pub_id}",
        json={"is_active": True}
    )
    
    # Create unpublished (draft) lecture
    draft_response = client.post(
        f"/api/v1/subjects/{setup['uni_id']}/{setup['faculty_id']}/{setup['subject_id']}/lectures",
        json={"title": "Draft Lecture", "description": "Not public"}
    )
    assert draft_response.status_code == 201
    
    # Switch to admin user
    set_user(DummyUser(id=setup["admin_id"], email=f"admin_{setup['unique_code']}@test.edu", is_root=False))
    
    # Admin should see ALL lectures (both published and unpublished)
    response = client.get(f"/api/v1/subjects/{setup['uni_id']}/{setup['faculty_id']}/{setup['subject_id']}/lectures")
    assert response.status_code == 200
    data = response.json()
    
    # Admin sees both published and draft lectures
    assert len(data) == 2, "Admin should see both published and unpublished lectures"
    titles = sorted([lec["title"] for lec in data])
    assert titles == ["Draft Lecture", "Published Lecture"]

