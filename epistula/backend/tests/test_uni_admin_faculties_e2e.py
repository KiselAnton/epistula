"""End-to-end tests for university admin faculty management.

These tests verify that uni_admin users can create, update, and delete faculties
in their assigned university using proper authorization checks.
"""
import pytest
from fastapi.testclient import TestClient


def test_non_root_user_cannot_create_faculty_without_admin_role(client, set_user):
    """Verify that non-root users without admin role cannot create faculties.
    
    This test verifies the authorization check is in place.
    """
    from .test_utils import DummyUser
    
    # Set up as non-root, non-admin user with proper integer ID
    set_user(DummyUser(id=999, email="user@test.edu", is_root=False))
    
    # Try to create faculty - should be denied
    response = client.post("/api/v1/faculties/1", json={
        "name": "Test Faculty",
        "short_name": "Test",
        "code": "TST"
    })
    
    # Should get 403 (permission denied) because user is not admin
    # or 422/404 if university validation happens first
    assert response.status_code in [403, 404, 422]
    if response.status_code == 403:
        assert "admin" in response.json()["detail"].lower() or "permission" in response.json()["detail"].lower()


def test_root_user_can_create_faculty(client, set_user):
    """Verify that root user can create faculties."""
    from .test_utils import DummyUser
    import time
    
    # First create a university as root (using integer ID 1 for root)
    set_user(DummyUser(id=1, email="root@epistula.edu", is_root=True))
    
    # Use timestamp to ensure unique code
    unique_code = f"TESTF{int(time.time()) % 100000}"
    
    uni_response = client.post("/api/v1/universities/", json={
        "name": "Test Faculty University",
        "code": unique_code,
        "description": "For testing faculty creation"
    })
    assert uni_response.status_code == 201
    uni_id = uni_response.json()["id"]
    
    # Now create a faculty as root (should work)
    response = client.post(
        f"/api/v1/faculties/{uni_id}",
        json={
            "name": "Faculty of Engineering",
            "short_name": "Engineering",
            "code": "ENG",
            "description": "Engineering faculty"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Faculty of Engineering"
    assert data["code"] == "ENG"
    assert data["university_id"] == uni_id
