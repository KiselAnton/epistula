from fastapi.testclient import TestClient
from .test_utils import DummyUser


def test_create_student_with_faculty_assignment(client, set_user):
    # Root user can manage users in any university
    set_user(DummyUser(is_root=True, id=100))

    import utils.database as db_mod
    import main as app_main
    from datetime import datetime, timezone

    UNI_ID = 123
    SCHEMA = f"uni_{UNI_ID}"

    class _Res:
        def __init__(self, row=None, rows=None):
            self._row = row
            self._rows = rows or ([] if row is None else [row])
        def fetchone(self):
            return self._row
        def fetchall(self):
            return self._rows

    class _Sess:
        def __init__(self):
            self.committed = False
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # get_university_schema
            if "FROM public.universities" in sql and "SELECT schema_name" in sql:
                return _Res((SCHEMA,))
            # Validate faculty exists
            if f"FROM {SCHEMA}.faculties" in sql and "SELECT id" in sql:
                return _Res((params.get("faculty_id", 1),))
            # Check email existence
            if "FROM public.users" in sql and "SELECT id FROM public.users WHERE email" in sql:
                return _Res(row=None)
            # Insert user
            if "INSERT INTO public.users" in sql and "RETURNING id" in sql:
                return _Res((777,))
            # Insert user_university_roles
            if "INSERT INTO public.user_university_roles" in sql and "RETURNING id, created_at" in sql:
                return _Res((1, datetime.now(timezone.utc)))
            # Check existing faculty_students assignment
            if f"FROM {SCHEMA}.faculty_students" in sql and "SELECT 1" in sql:
                return _Res(row=None)
            # Insert into faculty_students
            if f"INSERT INTO {SCHEMA}.faculty_students" in sql:
                # No RETURNING in this insert in code; accept and return empty
                return _Res()
            return _Res()
        def commit(self):
            self.committed = True
        def rollback(self):
            pass

    def _override_db():
        yield _Sess()

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        payload = {
            "email": "stud@example.com",
            "name": "Student One",
            "password": "Secret123!",
            "role": "student",
            "faculty_id": 1
        }
        r = client.post(f"/api/v1/universities/{UNI_ID}/users", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["id"] == 777
        assert body["role"] == "student"
        assert body["faculty_id"] == 1
        assert body["email"] == "stud@example.com"
    finally:
        app_main.app.dependency_overrides.clear()
