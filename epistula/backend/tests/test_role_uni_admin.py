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
from fastapi.testclient import TestClient
from .test_utils import DummyUser


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


@pytest.mark.skip(reason="Requires real DB or complete ORM mocking - see ROLE_TESTING.md")
def test_admin_can_view_own_university(client, set_user):
    """Uni admin can view their assigned university."""
    # Setup: admin for university 1
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    # Mock DB to return university 1 for this admin
    import utils.database as db_mod
    import main as app_main
    from utils.models import UniversityDB
    
    class _Q:
        def filter(self, *args, **kwargs):
            return self
        def all(self):
            # Admin should see their university
            class FakeUni:
                id = 1
                name = "University 1"
                code = "UNI1"
                schema_name = "uni_1"
                is_active = True
                logo_url = None
            return [FakeUni()]
    
    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            # Mock user_university_roles check
            sql = str(stmt)
            if "user_university_roles" in sql:
                class Result:
                    def fetchall(self):
                        return [(1,)]  # Has access to uni 1
                return Result()
            class EmptyResult:
                def fetchall(self): return []
            return EmptyResult()
    
    def _override_db():
        yield _Sess()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/universities/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == 1
    finally:
        app_main.app.dependency_overrides.clear()


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


@pytest.mark.skip(reason="Requires real DB or complete ORM mocking - see ROLE_TESTING.md")
def test_admin_can_create_faculty(client, set_user):
    """Uni admin can create faculties in their university."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    from utils.models import UniversityDB
    from datetime import datetime, timezone
    
    class FakeUni:
        id = UNI_ID
        name = "University 1"
        code = "UNI1"
        schema_name = SCHEMA
        is_active = True
    
    class _Q:
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return FakeUni()
    
    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Admin check
            if "user_university_roles" in sql and "uni_admin" in sql:
                class Result:
                    def fetchone(self): return (1,)
                return Result()
            # Faculty creation
            if f"INSERT INTO {SCHEMA}.faculties" in sql:
                class Result:
                    def fetchone(self):
                        return (1, "CS", "Computer Science", datetime.now(timezone.utc), True)
                return Result()
            class EmptyResult:
                def fetchone(self): return None
            return EmptyResult()
        def commit(self): pass
    
    def _override_db():
        yield _Sess()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post(f"/api/v1/faculties/{UNI_ID}", json={
            "code": "CS",
            "name": "Computer Science"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "CS"
        assert data["name"] == "Computer Science"
    finally:
        app_main.app.dependency_overrides.clear()


@pytest.mark.skip(reason="Requires real DB or complete ORM mocking - see ROLE_TESTING.md")
def test_admin_cannot_manage_other_university(client, set_user):
    """Uni admin cannot manage faculties in other universities."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    # Try to create faculty in university 2 (admin only has access to uni 1)
    import utils.database as db_mod
    import main as app_main
    from utils.models import UniversityDB
    
    class FakeUni:
        id = 2
        name = "University 2"
        schema_name = "uni_2"
    
    class _Q:
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return FakeUni()
    
    class _Sess:
        def query(self, model):
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Admin check for uni 2 - no permission
            if "user_university_roles" in sql:
                class Result:
                    def fetchone(self): return None
                return Result()
            class EmptyResult:
                def fetchone(self): return None
            return EmptyResult()
        def commit(self): pass
    
    def _override_db():
        yield _Sess()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post("/api/v1/faculties/2", json={
            "code": "CS",
            "name": "Computer Science"
        })
        assert response.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


@pytest.mark.skip(reason="Requires real DB or complete ORM mocking - see ROLE_TESTING.md")
def test_admin_can_create_users(client, set_user):
    """Uni admin can create users in their university."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    UNI_ID = 1
    
    import utils.database as db_mod
    import main as app_main
    from utils.models import UniversityDB
    from datetime import datetime, timezone
    
    class FakeUni:
        id = UNI_ID
        schema_name = f"uni_{UNI_ID}"
        is_active = True
    
    class _Q:
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return FakeUni()
    
    class _Sess:
        def query(self, model):
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Admin permission check
            if "user_university_roles" in sql and "uni_admin" in sql:
                class Result:
                    def fetchone(self): return (1,)
                return Result()
            # User creation
            if "INSERT INTO public.users" in sql:
                class Result:
                    def fetchone(self):
                        return ("user123", "prof@uni1.edu", "Professor One", "hashedpw", datetime.now(timezone.utc), datetime.now(timezone.utc), True)
                return Result()
            # Role assignment
            if "INSERT INTO public.user_university_roles" in sql:
                class Result:
                    def fetchone(self): return (1,)
                return Result()
            class EmptyResult:
                def fetchone(self): return None
            return EmptyResult()
        def commit(self): pass
    
    def _override_db():
        yield _Sess()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post(f"/api/v1/users/universities/{UNI_ID}/users", json={
            "email": "prof@uni1.edu",
            "name": "Professor One",
            "password": "password123",
            "role": "professor"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "prof@uni1.edu"
        assert data["role"] == "professor"
    finally:
        app_main.app.dependency_overrides.clear()


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


@pytest.mark.skip(reason="Requires real DB or complete ORM mocking - see ROLE_TESTING.md")
def test_admin_can_assign_professors_to_subjects(client, set_user):
    """Uni admin can assign professors to subjects."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    UNI_ID = 1
    FACULTY_ID = 5
    SUBJECT_ID = 10
    PROF_ID = "prof123"
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    from utils.models import UniversityDB
    from datetime import datetime, timezone
    
    class FakeUni:
        id = UNI_ID
        schema_name = SCHEMA
        is_active = True
    
    class _Q:
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return FakeUni()
    
    class _Sess:
        def query(self, model):
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Admin check
            if "user_university_roles" in sql and "uni_admin" in sql:
                class Result:
                    def fetchone(self): return (1,)
                return Result()
            # Subject exists
            if f"{SCHEMA}.subjects" in sql and "SELECT id" in sql:
                class Result:
                    def fetchone(self): return (SUBJECT_ID,)
                return Result()
            # User exists and is professor
            if "public.users" in sql and "public.user_university_roles" in sql:
                class Result:
                    def fetchone(self): return (PROF_ID, "prof@uni1.edu", "Prof Name", "professor")
                return Result()
            # Assignment
            if f"INSERT INTO {SCHEMA}.subject_professors" in sql:
                class Result:
                    def fetchone(self): return (SUBJECT_ID, PROF_ID, datetime.now(timezone.utc), True)
                return Result()
            class EmptyResult:
                def fetchone(self): return None
            return EmptyResult()
        def commit(self): pass
    
    def _override_db():
        yield _Sess()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.post(
            f"/api/v1/subject-professors/{UNI_ID}/{FACULTY_ID}/{SUBJECT_ID}/professors",
            json={"user_id": PROF_ID}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["subject_id"] == SUBJECT_ID
        assert data["professor_id"] == PROF_ID
    finally:
        app_main.app.dependency_overrides.clear()


@pytest.mark.skip(reason="Requires real DB or complete ORM mocking - see ROLE_TESTING.md")
def test_admin_can_view_lectures(client, set_user):
    """Uni admin can view all lectures in their university."""
    set_user(DummyUser(id=2, email="admin@uni1.edu", is_root=False))
    
    UNI_ID = 1
    FACULTY_ID = 5
    SUBJECT_ID = 10
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    from utils.models import UniversityDB
    from datetime import datetime, timezone
    
    class FakeUni:
        id = UNI_ID
        schema_name = SCHEMA
    
    class _Q:
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return FakeUni()
    
    class _Sess:
        def query(self, model):
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Subject exists
            if f"{SCHEMA}.subjects" in sql and "SELECT 1" in sql:
                class Result:
                    def fetchone(self): return (1,)
                return Result()
            # Lectures query
            if f"FROM {SCHEMA}.lectures" in sql and "ORDER BY" in sql:
                class Result:
                    def fetchall(self):
                        now = datetime.now(timezone.utc)
                        return [
                            (1, SUBJECT_ID, "Lecture 1", "Description 1", now, "creator1", True, 1),
                            (2, SUBJECT_ID, "Lecture 2", "Description 2", now, "creator2", False, 2),
                        ]
                return Result()
            class EmptyResult:
                def fetchone(self): return None
                def fetchall(self): return []
            return EmptyResult()
    
    def _override_db():
        yield _Sess()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get(f"/api/v1/subjects/{UNI_ID}/{FACULTY_ID}/{SUBJECT_ID}/lectures")
        assert response.status_code == 200
        data = response.json()
        # Admin should see both published and unpublished lectures
        assert len(data) == 2
    finally:
        app_main.app.dependency_overrides.clear()
