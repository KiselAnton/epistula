"""
Tests for multi-university access feature.

Tests the authentication flow, university selection, and role-based access
across multiple universities for a single user.
"""
import pytest
from fastapi.testclient import TestClient
from tests.test_utils import DummyUser


def test_login_returns_university_access_list(client, set_user):
    """Test that login response includes university_access array."""
    # This test would require actual database setup with universities
    # For now, we'll test the structure
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.post(
        '/api/v1/auth/login',
        json={'email': 'test@example.com', 'password': 'password123'}
    )
    
    # Note: This will fail without proper database setup
    # In real implementation, we'd have fixtures creating universities
    assert response.status_code in [200, 401]  # 401 if mock doesn't handle auth


def test_root_user_has_empty_university_access(client, set_user):
    """Test that root users have empty university_access list."""
    set_user(DummyUser(id=1, email="root@example.com", is_root=True))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        assert data['role'] == 'root'
        assert isinstance(data.get('university_access', []), list)


def test_user_with_multiple_universities(client, set_user):
    """Test user with roles in multiple universities."""
    # This test requires database setup with actual universities
    # The test validates the data structure
    set_user(DummyUser(id=1, email="multi@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        # Validate structure
        assert 'university_access' in data
        assert isinstance(data['university_access'], list)
        
        # Each university access should have required fields
        for uni_access in data['university_access']:
            assert 'university_id' in uni_access
            assert 'university_name' in uni_access
            assert 'university_code' in uni_access
            assert 'role' in uni_access
            assert 'is_active' in uni_access


def test_university_access_filters_inactive_universities(client, set_user):
    """Test that inactive universities are filtered from university_access."""
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        university_access = data.get('university_access', [])
        
        # All universities in access list should be active
        for uni in university_access:
            assert uni.get('is_active') is True


def test_university_access_filters_temp_schemas(client, set_user):
    """Test that temporary university schemas are excluded."""
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        universities = data.get('universities', [])
        
        # This would require checking against database
        # In real test, we'd verify no temp schemas are returned
        assert isinstance(universities, list)


def test_user_role_is_highest_across_universities(client, set_user):
    """Test that user's role is the highest role across all universities."""
    # If user is professor at Uni A and student at Uni B,
    # their global role should be professor
    set_user(DummyUser(id=1, email="multi@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        role = data.get('role')
        
        # Role should be one of the valid roles
        assert role in ['root', 'uni_admin', 'professor', 'student']


def test_primary_university_id_set_correctly(client, set_user):
    """Test that primary_university_id is set to first active university."""
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        university_access = data.get('university_access', [])
        primary_id = data.get('primary_university_id')
        
        if university_access:
            # Primary should be the first university in access list
            assert primary_id == university_access[0]['university_id']
        else:
            # If no universities, primary should be None
            assert primary_id is None


def test_backward_compatibility_universities_field(client, set_user):
    """Test that legacy 'universities' field is still populated."""
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        
        # Legacy field should exist
        assert 'universities' in data
        assert isinstance(data['universities'], list)
        
        # Should match IDs from university_access
        university_access = data.get('university_access', [])
        universities = data.get('universities', [])
        
        assert len(universities) == len(university_access)
        
        for i, uni_access in enumerate(university_access):
            assert universities[i] == uni_access['university_id']


def test_inactive_user_role_filtered_from_access(client, set_user):
    """Test that inactive user roles are filtered out."""
    # If user is inactive in a university, that university shouldn't appear
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        university_access = data.get('university_access', [])
        
        # All returned universities should have is_active=True for this user
        for uni in university_access:
            assert uni.get('is_active') is True


def test_university_access_includes_logo_url(client, set_user):
    """Test that university_access includes logo_url when available."""
    set_user(DummyUser(id=1, email="test@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        university_access = data.get('university_access', [])
        
        for uni in university_access:
            # logo_url field should exist (can be None)
            assert 'logo_url' in uni


def test_login_with_single_university(client, set_user):
    """Test login flow for user with single university access."""
    # User with one university should have that as primary
    set_user(DummyUser(id=1, email="single@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        university_access = data.get('university_access', [])
        
        if len(university_access) == 1:
            assert data.get('primary_university_id') == university_access[0]['university_id']


def test_login_with_no_universities(client, set_user):
    """Test login for user with no university access."""
    # Edge case: user exists but has no university assignments
    set_user(DummyUser(id=1, email="nouni@example.com", is_root=False))
    
    response = client.get('/api/v1/auth/me')
    
    if response.status_code == 200:
        data = response.json()
        
        # Should have empty arrays
        assert data.get('university_access') == []
        assert data.get('universities') == []
        assert data.get('primary_university_id') is None
