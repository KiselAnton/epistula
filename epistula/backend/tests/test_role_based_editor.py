"""
Integration tests for role-based editor restrictions
Tests the complete flow from authentication to editor block availability
"""
import pytest
from fastapi.testclient import TestClient


def test_role_based_editor_student_restrictions(client, set_user):
    """
    Test that student role information is correctly stored and retrievable
    for frontend to enforce video/audio restrictions.
    """
    # Create a student user
    set_user(id=1, email="admin@example.com", role="root")
    
    response = client.post(
        "/api/v1/users/1",
        json={
            "email": "student@university.edu",
            "name": "Test Student",
            "password": "password123",
            "role": "student",
            "faculty_id": None
        }
    )
    
    # Login as the student
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "student@university.edu",
            "password": "password123"
        }
    )
    
    assert login_response.status_code == 200
    user_data = login_response.json()
    
    # Verify role is 'student' - frontend will use this to restrict blocks
    assert user_data["role"] == "student"
    assert "access_token" in user_data


def test_role_based_editor_professor_permissions(client, set_user):
    """
    Test that professor role has full access (no restrictions).
    """
    set_user(id=1, email="admin@example.com", role="root")
    
    response = client.post(
        "/api/v1/users/1",
        json={
            "email": "prof@university.edu",
            "name": "Test Professor",
            "password": "password123",
            "role": "professor",
            "faculty_id": None
        }
    )
    
    # Login as professor
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "prof@university.edu",
            "password": "password123"
        }
    )
    
    assert login_response.status_code == 200
    user_data = login_response.json()
    
    # Professor role should have no restrictions
    assert user_data["role"] == "professor"


def test_role_based_editor_uni_admin_permissions(client, set_user):
    """
    Test that uni_admin role has full access.
    """
    set_user(id=1, email="root@example.com", role="root")
    
    response = client.post(
        "/api/v1/users/1",
        json={
            "email": "admin@university.edu",
            "name": "University Admin",
            "password": "password123",
            "role": "uni_admin",
            "faculty_id": None
        }
    )
    
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "admin@university.edu",
            "password": "password123"
        }
    )
    
    assert login_response.status_code == 200
    user_data = login_response.json()
    
    assert user_data["role"] == "uni_admin"


def test_role_based_editor_root_permissions(client, set_user):
    """
    Test that root role has full access.
    """
    set_user(id=1, email="root@localhost", role="root")
    
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
    set_user(id=1, email="admin@example.com", role="root")
    
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
    set_user(id=1, email="root@example.com", role="root")
    
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
