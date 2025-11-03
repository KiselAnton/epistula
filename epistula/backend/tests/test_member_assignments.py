"""Tests for member assignment endpoints (faculty_professors, faculty_students, subject assignments)."""

from datetime import datetime

from .test_utils import DummyUser


class _Res:
    def __init__(self, row=None, rows=None, rowcount: int = 0):
        self._row = row
        self._rows = rows
        self.rowcount = rowcount
    def fetchone(self):
        return self._row
    def fetchall(self):
        return self._rows or []


class _Query:
    def __init__(self, schema_name="uni_1"):
        self._uni = type("_U", (), {"id": 1, "schema_name": schema_name})()
    def filter(self, *args, **kwargs):
        return self
    def first(self):
        return self._uni


class _Sess:
    """Flexible session mock that responds based on SQL substrings."""
    def __init__(self):
        self._schema = "uni_1"
    # ORM-like .query used for UniversityDB lookups
    def query(self, *args, **kwargs):
        return _Query(schema_name=self._schema)
    def execute(self, stmt, params=None):
        sql = getattr(stmt, "text", str(stmt))

        # Faculty exists checks
        if "FROM uni_1.faculties" in sql:
            return _Res((1,))

        # Subject exists checks
        if "FROM uni_1.subjects" in sql and "WHERE id =" in sql:
            return _Res((1,))

        # Professor active role check
        if ("JOIN public.user_university_roles" in sql or "FROM public.user_university_roles" in sql) and "role = 'professor'" in sql:
            return _Res(("Prof Name", "prof@test.com"))

        # Student active role check
        if ("JOIN public.user_university_roles" in sql or "FROM public.user_university_roles" in sql) and "role = 'student'" in sql:
            return _Res(("Stud Name", "stud@test.com"))

        # faculty_professors duplicate check
        if "FROM uni_1.faculty_professors" in sql and "WHERE faculty_id" in sql and "professor_id" in sql and "SELECT" in sql:
            return _Res(None)

        # faculty_students active membership check (for subject enroll precondition)
        if "FROM uni_1.faculty_students" in sql and "WHERE faculty_id" in sql and "student_id" in sql and "is_active = TRUE" in sql:
            return _Res((1,))
        # faculty_students duplicate check (no is_active clause)
        if "FROM uni_1.faculty_students" in sql and "WHERE faculty_id" in sql and "student_id" in sql and "SELECT" in sql and "is_active" not in sql:
            return _Res(None)

        # subject_professors duplicate check
        if "FROM uni_1.subject_professors" in sql and "WHERE subject_id" in sql and "professor_id" in sql and "SELECT" in sql:
            return _Res(None)

        # subject_students duplicate check
        if "FROM uni_1.subject_students" in sql and "WHERE subject_id" in sql and "student_id" in sql and "SELECT" in sql:
            return _Res(None)

        # Insert into faculty_professors
        if "INSERT INTO uni_1.faculty_professors" in sql:
            return _Res((123, params.get("professor_id"), datetime(2024,1,1,0,0,0), params.get("assigned_by"), True))

        # Insert into faculty_students
        if "INSERT INTO uni_1.faculty_students" in sql:
            return _Res((124, params.get("sid") or params.get("student_id"), datetime(2024,1,1,0,0,0), params.get("ab") or params.get("user_id"), True))

        # Insert into subject_professors
        if "INSERT INTO uni_1.subject_professors" in sql:
            return _Res((321, datetime(2024,1,2,0,0,0)))

        # Insert into subject_students
        if "INSERT INTO uni_1.subject_students" in sql:
            return _Res((322, datetime(2024,1,3,0,0,0)))

        # Listing joins returning rows
        if "FROM uni_1.faculty_professors fp" in sql and "JOIN public.users" in sql:
            return _Res(rows=[(1, 50, "Prof A", "a@t", datetime(2024,1,1), 1, True)])
        if "FROM uni_1.faculty_students fs" in sql and "JOIN public.users" in sql:
            return _Res(rows=[(2, 60, "Stud A", "s@t", datetime(2024,1,1), 1, True)])
        if "FROM uni_1.subject_professors sp" in sql and "JOIN public.users" in sql:
            return _Res(rows=[(3, 50, "Prof A", "a@t", datetime(2024,1,1), True)])
        if "FROM uni_1.subject_students ss" in sql and "JOIN public.users" in sql:
            return _Res(rows=[(4, 60, "Stud A", "s@t", datetime(2024,1,1), "active")])

        # Professor details by id
        if "FROM public.users" in sql and "WHERE id = :professor_id" in sql:
            return _Res(("Prof Name", "prof@test.com"))

        # Student details by id
        if "FROM public.users" in sql and "WHERE id = :student_id" in sql:
            return _Res(("Stud Name", "stud@test.com"))

        # Deletes (return a rowcount via _Res)
        if "DELETE FROM uni_1.subject_professors" in sql:
            return _Res(rowcount=1)
        if "DELETE FROM uni_1.subject_students" in sql:
            return _Res(rowcount=1)

        return _Res()

    def commit(self):
        pass


def _override_db_factory():
    def _override_db():
        yield _Sess()
    return _override_db


def test_assign_professor_to_faculty_success(client, monkeypatch, set_user):
    import routers.faculty_professors as fp_router
    import utils.database as db_mod
    import main as app_main

    # Root user
    set_user(DummyUser(id=1, is_root=True))
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db_factory()

    try:
        r = client.post("/api/v1/faculties/1/10/professors", json={"professor_id": 50})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["professor_id"] == 50
        assert body["professor_name"] == "Prof Name"
        assert body["is_active"] is True
    finally:
        app_main.app.dependency_overrides.clear()


def test_assign_student_to_faculty_success(client, monkeypatch, set_user):
    import routers.faculty_students as fs_router
    import utils.database as db_mod
    import main as app_main

    set_user(DummyUser(id=1, is_root=True))
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db_factory()

    try:
        r = client.post("/api/v1/faculties/1/10/students", json={"student_id": 60})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["student_id"] == 60
        assert body["student_name"] == "Stud Name"
    finally:
        app_main.app.dependency_overrides.clear()


def test_assign_professor_to_subject_requires_faculty_assignment(client, monkeypatch, set_user):
    """If professor not in faculty, assigning to subject returns 400."""
    import routers.subject_professors as sp_router
    import utils.database as db_mod
    import main as app_main

    # Override session to simulate missing faculty assignment
    class _SessNoFaculty(_Sess):
        def execute(self, stmt, params=None):
            sql = getattr(stmt, "text", str(stmt))
            if "FROM uni_1.subjects" in sql and "WHERE id =" in sql:
                return _Res((1,))
            if "FROM uni_1.faculty_professors" in sql and "WHERE faculty_id" in sql and "professor_id" in sql:
                return _Res(None)  # Not assigned -> triggers 400
            return super().execute(stmt, params)

    def _override_db():
        yield _SessNoFaculty()

    set_user(DummyUser(id=1, is_root=True))
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/subjects/1/10/100/professors", json={"professor_id": 50})
        assert r.status_code == 400
        assert "assigned to the faculty" in r.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_enroll_student_in_subject_success(client, monkeypatch, set_user):
    import routers.subject_students as ss_router
    import utils.database as db_mod
    import main as app_main

    set_user(DummyUser(id=1, is_root=True))
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db_factory()

    try:
        r = client.post("/api/v1/subjects/1/10/100/students", json={"student_id": 60})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["student_id"] == 60
        assert body["status"] == "active"
    finally:
        app_main.app.dependency_overrides.clear()
