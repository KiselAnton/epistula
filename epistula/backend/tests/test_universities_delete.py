"""Tests for university deletion endpoint and backup preservation logic."""
import pytest
from pathlib import Path
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


def test_delete_production_university_preserves_backups(
    client, 
    set_user,
    monkeypatch
):
    """Deleting a production university should preserve its backups for future restoration."""
    from utils.models import University
    from .test_utils import DummyUser
    import main as app_main
    import utils.database as db_mod
    
    # Set root user
    set_user(DummyUser(is_root=True))
    
    backup_dir_preserved = False
    marker_written = False
    marker_content = None

    # Create a mock university that will be returned by the DB query
    mock_uni = MagicMock(spec=University)
    mock_uni.id = 42
    mock_uni.name = "Test University"
    mock_uni.schema_name = "uni_42"  # Not a temp schema
    mock_uni.logo_url = None

    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_uni
    mock_result.scalar.return_value = True  # schema_exists check
    
    # Mock datetime result for marker timestamp
    mock_datetime_result = MagicMock()
    mock_datetime_result.scalar.return_value = "2025-11-03 12:00:00"

    # Track execute calls
    execute_calls = []
    
    def mock_execute(stmt, *args, **kwargs):
        execute_calls.append(str(stmt))
        if "SELECT NOW()" in str(stmt).upper():
            return mock_datetime_result
        return mock_result

    # Mock the DB session
    class MockSession:
        def execute(self, stmt, *args, **kwargs):
            return mock_execute(stmt, *args, **kwargs)
        def query(self, *args):
            # Return a mock query object that supports filter().first()
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.first.return_value = mock_uni
            return mock_query
        def delete(self, obj):
            pass
        def commit(self):
            pass
        def rollback(self):
            pass
    
    def _override_db():
        yield MockSession()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    # Mock Path operations
    def mock_path_exists(self):
        nonlocal backup_dir_preserved
        if "backups/database/uni_42" in str(self):
            backup_dir_preserved = True
            return True
        return False

    def mock_write_text(self, content):
        nonlocal marker_written, marker_content
        if ".university_deleted" in str(self):
            marker_written = True
            marker_content = content

    # Mock Path operations
    class MockPath:
        def __init__(self, *args):
            self.path_str = str(args[0]) if args else ""
        
        def exists(self):
            nonlocal backup_dir_preserved
            if "backups/database/uni_42" in self.path_str:
                backup_dir_preserved = True
                return True
            return False
        
        def write_text(self, content):
            nonlocal marker_written, marker_content
            if ".university_deleted" in self.path_str:
                marker_written = True
                marker_content = content
        
        def __truediv__(self, other):
            return MockPath(f"{self.path_str}/{other}")
        
        def __str__(self):
            return self.path_str

    monkeypatch.setattr("routers.universities.Path", MockPath)

    try:
        # Call delete endpoint
        response = client.delete("/api/v1/universities/42")
        
        assert response.status_code == 204
        assert backup_dir_preserved is True, "Backup directory should have been checked"
        assert marker_written is True, "Deletion marker should have been written"
        assert "Test University" in marker_content
        assert "42" in marker_content
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_temp_university_removes_backups(
    client,
    set_user, 
    monkeypatch
):
    """Deleting a temp university should remove its backups (they're just test data)."""
    from utils.models import University
    from .test_utils import DummyUser
    import main as app_main
    import utils.database as db_mod
    import shutil

    # Set root user
    set_user(DummyUser(is_root=True))

    backup_dir_deleted = None

    # Create a mock temp university
    mock_uni = MagicMock(spec=University)
    mock_uni.id = 99
    mock_uni.name = "Temp Test Uni"
    mock_uni.schema_name = "uni_1_temp"  # Temp schema
    mock_uni.logo_url = None

    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_uni
    mock_result.scalar.return_value = True  # schema_exists check

    def mock_execute(stmt, *args, **kwargs):
        return mock_result

    # Mock the DB session
    class MockSession:
        def execute(self, stmt, *args, **kwargs):
            return mock_execute(stmt, *args, **kwargs)
        def query(self, *args):
            # Return a mock query object that supports filter().first()
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.first.return_value = mock_uni
            return mock_query
        def delete(self, obj):
            pass
        def commit(self):
            pass
        def rollback(self):
            pass
    
    def _override_db():
        yield MockSession()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    # Mock Path.exists to return True
    class MockPath:
        def __init__(self, *args):
            self.path_str = str(args[0]) if args else ""
        
        def exists(self):
            return "backups/database/uni_99" in self.path_str
        
        def __truediv__(self, other):
            return MockPath(f"{self.path_str}/{other}")
        
        def __str__(self):
            return self.path_str

    monkeypatch.setattr("routers.universities.Path", MockPath)

    # Mock shutil.rmtree to track deletion
    def mock_rmtree(path):
        nonlocal backup_dir_deleted
        backup_dir_deleted = str(path)

    monkeypatch.setattr("routers.universities.shutil.rmtree", mock_rmtree)

    try:
        # Call delete endpoint
        response = client.delete("/api/v1/universities/99")
        
        assert response.status_code == 204
        assert backup_dir_deleted is not None
        assert "uni_99" in backup_dir_deleted
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_university_requires_root(
    client,
    set_user,
    monkeypatch
):
    """Non-root users cannot delete universities."""
    from utils.models import University
    from .test_utils import DummyUser
    import main as app_main
    import utils.database as db_mod
    
    # Set non-root user
    set_user(DummyUser(is_root=False))
    
    # Create a mock university
    mock_uni = MagicMock(spec=University)
    mock_uni.id = 1
    mock_uni.name = "Some Uni"
    mock_uni.schema_name = "uni_1"

    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_uni

    def mock_execute(stmt, *args, **kwargs):
        return mock_result

    # Mock the DB session
    class MockSession:
        def execute(self, stmt, *args, **kwargs):
            return mock_execute(stmt, *args, **kwargs)
        def query(self, *args):
            # Return a mock query object that supports filter().first()
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.first.return_value = mock_uni
            return mock_query
    
    def _override_db():
        yield MockSession()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        response = client.delete("/api/v1/universities/1")
        
        assert response.status_code == 403
        assert "root" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_nonexistent_university(
    client,
    set_user,
    monkeypatch
):
    """Deleting a non-existent university returns 404."""
    from .test_utils import DummyUser
    import main as app_main
    import utils.database as db_mod
    
    # Set root user
    set_user(DummyUser(is_root=True))

    # Mock the DB session
    class MockSession:
        def execute(self, stmt, *args, **kwargs):
            pass
        def query(self, *args):
            # Return a mock query object that returns None from first()
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.first.return_value = None  # University not found
            return mock_query
    
    def _override_db():
        yield MockSession()
    
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        response = client.delete("/api/v1/universities/9999")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()
