"""Shared test utilities and fixtures.

This module contains common test classes, helpers, and data structures
used across multiple test files to avoid duplication.
"""
import datetime as _dt
from typing import Any, Optional


class DummyUser:
    """Minimal user object for testing authentication overrides."""
    def __init__(
        self,
        id: int = 1,
        email: str = "test@example.com",
        name: str = "Test User",
        is_root: bool = False,
        is_active: bool = True,
        created_at: Optional[_dt.datetime] = None,
        updated_at: Optional[_dt.datetime] = None,
    ):
        self.id = id
        self.email = email
        self.name = name
        self.is_root = is_root
        self.is_active = is_active
        self.created_at = created_at or _dt.datetime.now(_dt.timezone.utc)
        self.updated_at = updated_at or _dt.datetime.now(_dt.timezone.utc)


class FakeQuery:
    """Fake SQLAlchemy Query object for testing."""
    def __init__(self, model, data: list, apply_active_filter: bool = True):
        self._model = model
        self._data = data
        self._filters = []
        self._apply_active_filter = apply_active_filter

    def order_by(self, *args, **kwargs):
        """Chainable order_by operation."""
        return self

    def all(self):
        """Return all results, optionally filtering by is_active."""
        result = self._data
        if self._apply_active_filter:
            for f in self._filters:
                # Simple filter: if data has is_active attribute, filter by it
                result = [r for r in result if not hasattr(r, 'is_active') or r.is_active]
        return result

    def filter(self, *args, **kwargs):
        """Chainable filter operation."""
        self._filters.extend(args)
        return self

    def first(self):
        """Return first result or None."""
        all_items = self.all()
        return all_items[0] if all_items else None


class FakeSession:
    """Fake SQLAlchemy Session for testing database operations."""
    def __init__(self, mapping: dict[type, list], apply_active_filter: bool = True):
        """
        Args:
            mapping: Dictionary mapping model classes to lists of instances
            apply_active_filter: Whether to auto-filter by is_active in queries
        """
        self._mapping = mapping
        self._committed = False
        self._apply_active_filter = apply_active_filter

    def query(self, *models):
        """Create a fake query for given model(s)."""
        if len(models) == 1:
            return FakeQuery(models[0], self._mapping.get(models[0], []), self._apply_active_filter)
        # Multi-model query returns empty by default
        return FakeQuery(None, [], self._apply_active_filter)

    def execute(self, *args, **kwargs):
        """Fake execute method for raw SQL."""
        class FakeResult:
            def fetchone(self):
                return None
            def fetchall(self):
                return []
            def scalar(self):
                return 0
        return FakeResult()

    def commit(self):
        """Fake commit."""
        self._committed = True

    def refresh(self, obj):
        """Fake refresh."""
        pass

    def rollback(self):
        """Fake rollback."""
        pass


class FakeUniversity:
    """Fake University object for testing."""
    def __init__(
        self,
        id: int,
        name: str,
        code: str,
        schema_name: str,
        is_active: bool = True,
        description: Optional[str] = None,
        logo_url: Optional[str] = None,
        created_at: Optional[_dt.datetime] = None,
        updated_at: Optional[_dt.datetime] = None,
    ):
        self.id = id
        self.name = name
        self.code = code
        self.schema_name = schema_name
        self.is_active = is_active
        self.description = description
        self.logo_url = logo_url
        self.created_at = created_at or _dt.datetime.now(_dt.timezone.utc)
        self.updated_at = updated_at or _dt.datetime.now(_dt.timezone.utc)


class FakeUserUniversityRole:
    """Fake UserUniversityRole object for testing."""
    def __init__(self, user_id: int, university_id: int, role: str):
        self.user_id = user_id
        self.university_id = university_id
        self.role = role


class FakeS3Error(Exception):
    """Fake S3Error for testing MinIO operations."""
    def __init__(self, code: str, message: str):
        self._code = code
        self._message = message
        super().__init__(message)

    @property
    def code(self):
        return self._code

    def __str__(self):
        return f"{self._code}: {self._message}"
