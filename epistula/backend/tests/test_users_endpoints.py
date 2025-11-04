"""Tests for user management endpoints."""

from .test_utils import DummyUser


def test_create_user_happy_path(client, monkeypatch, set_user):
    """Test creating a new user with all required fields."""
    import routers.users as users_router
    
    # Set root user
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    # Mock validate_university_access to pass
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    
    # Mock get_university_schema
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    # Mock hash_password
    monkeypatch.setattr(users_router, "hash_password", lambda pwd: "hashed_password")
    
    from datetime import datetime
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def __init__(self):
            self.executed_statements = []
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            self.executed_statements.append((sql_text, params))
            
            # Check if email exists
            if "SELECT id FROM public.users WHERE email" in sql_text:
                return _Res(None)  # User doesn't exist
            
            # Insert user
            if "INSERT INTO public.users" in sql_text and "RETURNING id" in sql_text:
                return _Res((100,))  # New user ID
            
            # Insert role (RETURNING id, created_at)
            if "INSERT INTO public.user_university_roles" in sql_text:
                return _Res((1, datetime(2024, 1, 1, 0, 0, 0)))
            
            # CREATE TABLE for users (from _ensure_user_table_exists)
            if "CREATE TABLE IF NOT EXISTS" in sql_text:
                return _Res(None)
            
            # Get created user
            if "SELECT u.id, u.email, u.name" in sql_text and "user_university_roles uur" in sql_text:
                return _Res((100, "new@test.com", "New User", "professor", None, True, "2024-01-01T00:00:00"))
            
            return _Res(None)
        
        def commit(self):
            pass
        
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post("/api/v1/universities/1/users", json={
            "name": "New User",
            "email": "new@test.com",
            "password": "password123",
            "role": "professor"
        })
        assert response.status_code == 201
        body = response.json()
        assert body["email"] == "new@test.com"
        assert body["name"] == "New User"
        assert body["role"] == "professor"
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_user_student_requires_faculty(client, monkeypatch, set_user):
    """Test that creating a student without faculty_id returns 400."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    class _Sess:
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post("/api/v1/universities/1/users", json={
            "name": "Student User",
            "email": "student@test.com",
            "password": "password123",
            "role": "student"
            # Missing faculty_id
        })
        assert response.status_code == 400
        assert "faculty" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_user_duplicate_email_and_role_returns_400(client, monkeypatch, set_user):
    """Test that creating a user with duplicate email and role returns 400."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # User exists
            if "SELECT id FROM public.users WHERE email" in sql_text:
                return _Res((50,))  # Existing user ID
            
            # User already has this role
            if "SELECT 1 FROM public.user_university_roles" in sql_text:
                return _Res((1,))  # Role exists
            
            return _Res(None)
        
        def commit(self):
            pass
        
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post("/api/v1/universities/1/users", json={
            "name": "Existing User",
            "email": "existing@test.com",
            "password": "password123",
            "role": "professor"
        })
        assert response.status_code == 400
        assert "already has this role" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_user_faculty_not_found_returns_404(client, monkeypatch, set_user):
    """Test that creating a student with non-existent faculty returns 404."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # Faculty doesn't exist
            if "SELECT id FROM uni_1.faculties" in sql_text:
                return _Res(None)
            
            return _Res(None)
        
        def commit(self):
            pass
        
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post("/api/v1/universities/1/users", json={
            "name": "Student User",
            "email": "student@test.com",
            "password": "password123",
            "role": "student",
            "faculty_id": 999
        })
        assert response.status_code == 404
        assert "faculty not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_users_with_pagination(client, monkeypatch, set_user):
    """Test listing users (no pagination in API, ensure list/total work)."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    from datetime import datetime
    class _Res:
        def __init__(self, rows=None, scalar_val=None):
            self._rows = rows or []
            self._scalar_val = scalar_val
        def fetchall(self):
            return self._rows
        def scalar(self):
            return self._scalar_val
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # List users query: expect columns per router implementation
            if "FROM public.users u\n            JOIN public.user_university_roles uur" in sql_text or "JOIN public.user_university_roles uur" in sql_text:
                return _Res(rows=[
                    (10, "user1@test.com", "User One", True, "professor", None, datetime(2024,1,1,0,0,0), True),
                    (11, "user2@test.com", "User Two", True, "student", 5, datetime(2024,1,2,0,0,0), True),
                ])
            
            return _Res()
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/universities/1/users")
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2
        assert len(body["users"]) == 2
        assert body["users"][0]["email"] == "user1@test.com"
        assert body["users"][1]["role"] == "student"
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_users_with_role_filter(client, monkeypatch, set_user):
    """Test listing users filtered by role."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    from datetime import datetime
    class _Res:
        def __init__(self, rows=None, scalar_val=None):
            self._rows = rows or []
            self._scalar_val = scalar_val
        def fetchall(self):
            return self._rows
        def scalar(self):
            return self._scalar_val
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # Verify role filter is applied
            if "AND uur.role = :role" in sql_text:
                assert params.get("role") == "professor"
            
            if "FROM public.users u" in sql_text and "JOIN public.user_university_roles uur" in sql_text:
                return _Res(rows=[
                    (10, "prof@test.com", "Professor", True, "professor", None, datetime(2024,1,1,0,0,0), True),
                ])
            
            return _Res()
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/universities/1/users?role=professor")
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert all(u["role"] == "professor" for u in body["users"])
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_users_with_search(client, monkeypatch, set_user):
    """Test listing users with search query."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    from datetime import datetime
    class _Res:
        def __init__(self, rows=None, scalar_val=None):
            self._rows = rows or []
            self._scalar_val = scalar_val
        def fetchall(self):
            return self._rows
        def scalar(self):
            return self._scalar_val
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # Verify search pattern uses :pattern and param q
            if "AND (u.name ILIKE :pattern OR u.email ILIKE :pattern)" in sql_text:
                assert params.get("pattern") == "%john%"
            
            if "FROM public.users u" in sql_text and "JOIN public.user_university_roles uur" in sql_text:
                return _Res(rows=[
                    (10, "john@test.com", "John Doe", True, "professor", None, datetime(2024,1,1,0,0,0), True),
                    (12, "johnny@test.com", "Johnny", True, "student", None, datetime(2024,1,3,0,0,0), True),
                ])
            
            return _Res()
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/universities/1/users?q=john")
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_user_success(client, monkeypatch, set_user):
    """Test updating a user's information."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    monkeypatch.setattr(users_router, "hash_password", lambda pwd: "new_hashed_password")
    
    from datetime import datetime
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # Check user exists in university with join row
            if "FROM public.users u" in sql_text and "JOIN public.user_university_roles uur" in sql_text and "WHERE u.id = :user_id" in sql_text:
                # Return email, name, role, faculty_id, created_at, is_active
                return _Res(("user@test.com", "Old Name", "professor", None, datetime(2024,1,1,0,0,0), True))
            
            # Update user
            if "UPDATE public.users SET" in sql_text:
                return _Res(None)
            
            # No further select needed; function constructs response from previous values
            
            return _Res(None)
        
        def commit(self):
            pass
        
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/universities/1/users/50", json={
            "name": "Updated Name",
            "password": "newpassword123"
        })
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Updated Name"
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_user_success(client, monkeypatch, set_user):
    """Test deleting a user from a university."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # Check user has role
            if "SELECT 1 FROM public.user_university_roles" in sql_text:
                return _Res((1,))
            
            # Delete role
            if "DELETE FROM public.user_university_roles" in sql_text:
                return _Res(None)
            
            return _Res(None)
        
        def commit(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/universities/1/users/50")
        assert response.status_code == 204
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_user_not_found_returns_404(client, monkeypatch, set_user):
    """Test deleting a non-existent user returns 404."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    monkeypatch.setattr(users_router, "get_university_schema", lambda uid, db: "uni_1")
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            # User not found
            return _Res(None)
        
        def commit(self):
            pass
        
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/universities/1/users/999")
        assert response.status_code == 404
        assert "user not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_get_user_by_id_success(client, monkeypatch, set_user):
    """Test getting a user by ID within a university."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            
            # Get user with role in university
            if "SELECT u.id, u.email, u.name" in sql_text and "user_university_roles" in sql_text:
                return _Res((50, "user@test.com", "Test User", "professor", None, "2024-01-01T00:00:00", True))
            
            return _Res(None)
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/universities/1/users/50")
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == 50
        assert body["email"] == "user@test.com"
        assert body["name"] == "Test User"
    finally:
        app_main.app.dependency_overrides.clear()


def test_get_user_by_id_not_found_returns_404(client, monkeypatch, set_user):
    """Test getting a non-existent user returns 404."""
    import routers.users as users_router
    
    root = DummyUser(id=1, email="root@test.com", is_root=True)
    set_user(root)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def execute(self, stmt, params=None):
            return _Res(None)
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/universities/1/users/999")
        assert response.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()


def test_cannot_deactivate_self(client, monkeypatch, set_user):
    """Test that a user cannot deactivate themselves."""
    import routers.users as users_router
    
    # Admin user with ID 42
    admin = DummyUser(id=42, email="admin@test.com", is_root=False)
    set_user(admin)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    
    class _Sess:
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        # Try to deactivate self
        response = client.patch("/api/v1/universities/1/users/42", json={
            "is_active": False
        })
        assert response.status_code == 400
        assert "cannot deactivate yourself" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_cannot_delete_self(client, monkeypatch, set_user):
    """Test that a user cannot delete themselves."""
    import routers.users as users_router
    
    # Admin user with ID 42
    admin = DummyUser(id=42, email="admin@test.com", is_root=False)
    set_user(admin)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    
    class _Sess:
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        # Try to delete self
        response = client.delete("/api/v1/universities/1/users/42")
        assert response.status_code == 400
        assert "cannot delete yourself" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_can_activate_self(client, monkeypatch, set_user):
    """Test that a user can reactivate themselves (this should be allowed)."""
    import routers.users as users_router
    from datetime import datetime
    
    # Admin user with ID 42
    admin = DummyUser(id=42, email="admin@test.com", is_root=False)
    set_user(admin)
    
    monkeypatch.setattr(users_router, "validate_university_access", lambda user, uid, db: True)
    
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    
    class _Sess:
        def __init__(self):
            self.executed_statements = []
        def execute(self, stmt, params=None):
            sql_text = getattr(stmt, "text", str(stmt))
            self.executed_statements.append((sql_text, params))
            
            # Get user data
            if "SELECT u.email, u.name, uur.role" in sql_text:
                return _Res(("admin@test.com", "Admin User", "uni_admin", None, datetime(2024, 1, 1), False))
            
            # Update is_active
            if "UPDATE public.user_university_roles" in sql_text and "SET is_active" in sql_text:
                return _Res(None)
            
            return _Res(None)
        
        def commit(self):
            pass
        
        def rollback(self):
            pass
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        # Reactivate self should succeed
        response = client.patch("/api/v1/universities/1/users/42", json={
            "is_active": True
        })
        assert response.status_code == 200
        body = response.json()
        assert body["is_active"] is True
    finally:
        app_main.app.dependency_overrides.clear()

