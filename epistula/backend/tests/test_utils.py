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


# ------ New helpers for DRY SQL execute stubs in tests ------

class ExecRes:
    """Generic execute() result helper with fetchone/scalar.

    - row: tuple returned by fetchone()
    - count: integer returned by scalar()
    """
    def __init__(self, row: Optional[tuple] = None, count: int = 0):
        self._row = row
        self._count = count

    def fetchone(self):
        return self._row

    def fetchall(self):
        return [] if self._row is None else [self._row]

    def scalar(self):
        return self._count


def make_faculty_create_session(
    *,
    uni_id: int,
    schema_name: str,
    count_value: int = 0,
    inserted_row_builder=None,
):
    """Build a fake Session that supports faculty CREATE flow quickly.

    Args:
        uni_id: University ID to return from UniversityDB query
        schema_name: Schema used in SQL text checks (e.g., "uni_1")
        count_value: Value to return for the COUNT(*) uniqueness check
        inserted_row_builder: Callable(params: dict) -> tuple row for RETURNING

    Returns:
        An object mimicking the subset of Session used by the router.
    """
    from utils.models import UniversityDB  # lazy import to avoid top-level deps

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(uni_id, "U", "U", schema_name, True)

    class _Sess:
        def __init__(self):
            self._committed = False
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Uniqueness check
            if "SELECT COUNT(*)" in sql and f"FROM {schema_name}.faculties" in sql:
                return ExecRes(count=count_value)
            # Insert path
            if f"INSERT INTO {schema_name}.faculties" in sql and "RETURNING" in sql:
                if inserted_row_builder is None:
                    raise AssertionError("inserted_row_builder must be provided for insert path")
                return ExecRes(row=inserted_row_builder(params))
            return ExecRes()
        def commit(self):
            self._committed = True
        def rollback(self):
            pass

    return _Sess()


def make_university_missing_session():
    """Create a fake session where UniversityDB lookup returns None.

    Useful for quickly testing 404 University not found cases.
    """
    from utils.models import UniversityDB  # lazy import

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return None

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, *a, **k):
            return ExecRes()
        def commit(self):
            pass
        def rollback(self):
            pass

    return _Sess()


def make_subject_create_session(
    *,
    uni_id: int,
    schema_name: str,
    faculty_exists: bool = True,
    code_exists: bool = False,
    inserted_row_builder=None,
):
    """Fake session for subject creation flow.

    Detects faculty existence check, subject code uniqueness check, and insert.
    """
    from utils.models import UniversityDB  # lazy import

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(uni_id, "U", "U", schema_name, True)

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Faculty exists check
            if f"FROM {schema_name}.faculties" in sql and "SELECT id" in sql:
                return ExecRes(row=(1,)) if faculty_exists else ExecRes(row=None)
            # Subject code uniqueness: router selects id from subjects
            if f"FROM {schema_name}.subjects" in sql and "SELECT id" in sql:
                return ExecRes(row=(1,)) if code_exists else ExecRes(row=None)
            # Insert subject
            if f"INSERT INTO {schema_name}.subjects" in sql:
                if inserted_row_builder is None:
                    raise AssertionError("inserted_row_builder must be provided for subject insert")
                return ExecRes(row=inserted_row_builder(params))
            return ExecRes()
        def commit(self):
            pass
        def rollback(self):
            pass

    return _Sess()


def make_lecture_create_session(
    *,
    uni_id: int,
    schema_name: str,
    subject_exists: bool = True,
    max_order_next: int = 1,
    inserted_row_builder=None,
):
    """Fake session for lecture creation flow.

    Handles subject existence check, optional order_number query, inserting lecture,
    and optionally inserting content.
    """
    from utils.models import UniversityDB

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(uni_id, "U", "U", schema_name, True)

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Subject exists check
            if f"FROM {schema_name}.subjects" in sql and "SELECT id" in sql:
                return ExecRes(row=(params.get("subject_id", 1),)) if subject_exists else ExecRes(row=None)
            # Determine next order number if not provided
            if "COALESCE(MAX(order_number)" in sql and f"FROM {schema_name}.lectures" in sql:
                return ExecRes(count=max_order_next)
            # Insert lecture
            if f"INSERT INTO {schema_name}.lectures" in sql and "RETURNING id" in sql:
                if inserted_row_builder is None:
                    raise AssertionError("inserted_row_builder must be provided for lecture insert")
                return ExecRes(row=inserted_row_builder(params))
            # Insert content
            if f"INSERT INTO {schema_name}.lecture_content" in sql:
                return ExecRes()
            return ExecRes()
        def commit(self):
            pass
        def rollback(self):
            pass

    return _Sess()

