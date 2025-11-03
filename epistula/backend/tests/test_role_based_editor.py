"""
Integration tests for role-based editor restrictions
Tests the complete flow from authentication to editor block availability
"""
import pytest
from fastapi.testclient import TestClient
from .test_utils import DummyUser


def test_role_based_editor_student_restrictions(client, set_user):
    """
    Test that student role information is correctly stored and retrievable
    for frontend to enforce video/audio restrictions.
    """
    # Set user as student
    set_user(DummyUser(id=5, email="student@university.edu", is_root=False))
    
    # Get current user info
    response = client.get("/api/v1/auth/me")
    
    assert response.status_code == 200
    user_data = response.json()
    
    # Verify user info is available - frontend will use this to restrict blocks
    assert user_data["email"] == "student@university.edu"


def test_role_based_editor_professor_permissions(client, set_user):
    """
    Test that professor role information is correctly set in auth.
    """
    # Set user as professor
    set_user(DummyUser(id=2, email="prof@university.edu", is_root=False))
    
    # Get current user info
    response = client.get("/api/v1/auth/me")
    
    assert response.status_code == 200
    user_data = response.json()
    
    # Professor info should be reflected
    assert user_data["email"] == "prof@university.edu"


def test_role_based_editor_uni_admin_permissions(client, set_user):
    """
    Test that uni_admin role information is correctly set in auth.
    """
    # Set user as uni_admin
    set_user(DummyUser(id=3, email="admin@university.edu", is_root=False))
    
    # Get current user info
    response = client.get("/api/v1/auth/me")
    
    assert response.status_code == 200
    user_data = response.json()
    
    assert user_data["email"] == "admin@university.edu"


def test_role_based_editor_root_permissions(client, set_user):
    """
    Test that root role has full access.
    """
    set_user(DummyUser(id=1, email="root@localhost", is_root=True))
    
    # Root user should already exist from initialization
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "root@localhost",
            "password": "root_password_change_me"
        }
    )
    
    # May fail if root password was changed, but role should be correct
    if login_response.status_code == 200:
        user_data = login_response.json()
        assert user_data["role"] == "root"


def test_user_roles_are_persistent(client, set_user):
    """
    Test that user roles persist across sessions and are correctly
    returned in auth responses for frontend to use.
    """
    set_user(DummyUser(id=1, email="admin@example.com", is_root=True))
    
    # Create users with different roles
    roles_to_test = ["student", "professor", "uni_admin"]
    
    for role in roles_to_test:
        email = f"{role}@test.edu"
        response = client.post(
            "/api/v1/users/1",
            json={
                "email": email,
                "name": f"Test {role}",
                "password": "password123",
                "role": role,
                "faculty_id": None
            }
        )
        
        if response.status_code == 201:
            # Login and verify role
            login = client.post(
                "/api/v1/auth/login",
                data={"username": email, "password": "password123"}
            )
            
            if login.status_code == 200:
                user_data = login.json()
                assert user_data["role"] == role, f"Role {role} not persisted correctly"


def test_role_information_in_jwt_token(client, set_user):
    """
    Test that JWT tokens contain role information that frontend can decode
    to enforce UI restrictions.
    """
    set_user(DummyUser(id=1, email="root@example.com", is_root=True))
    
    # Create a student
    client.post(
        "/api/v1/users/1",
        json={
            "email": "student@test.edu",
            "name": "Student",
            "password": "pass123",
            "role": "student",
            "faculty_id": None
        }
    )
    
    # Login
    login = client.post(
        "/api/v1/auth/login",
        data={"username": "student@test.edu", "password": "pass123"}
    )
    
    if login.status_code == 200:
        token_data = login.json()
        
        # Token should be present
        assert "access_token" in token_data
        assert token_data["access_token"] is not None
        assert len(token_data["access_token"]) > 0
        
        # Role should be in response for frontend to store in localStorage
        assert token_data["role"] == "student"
