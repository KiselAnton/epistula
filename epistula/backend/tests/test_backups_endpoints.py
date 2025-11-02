import datetime as _dt


def test_get_university_backups_success(client, monkeypatch):
    # Patch permission check to pass and list_backups to return entries
    import routers.backups as backups_router

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    class _Entry:
        def __init__(self, name, size, ts, in_minio):
            self.name = name
            self.size_bytes = size
            self.created_at = ts
            self.in_minio = in_minio

    entries = [
        _Entry("u1_2024-01-01.sql.gz", 1234, _dt.datetime(2024, 1, 1), False),
        _Entry("u1_2024-01-02.sql.gz", 5678, _dt.datetime(2024, 1, 2), True),
    ]

    monkeypatch.setattr(backups_router, "list_backups", lambda university_id: entries)

    # Fake DB execute to return university name
    class _Res:
        def __init__(self, row):
            self._row = row
        def fetchone(self):
            return self._row

    class _Sess:
        def execute(self, stmt, params=None):
            return _Res(("Uni Name",))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/backups/1")
        assert r.status_code == 200
        body = r.json()
        assert body["university_id"] == 1
        assert body["university_name"] == "Uni Name"
        assert len(body["backups"]) == 2
        assert body["backups"][1]["in_minio"] is True
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_backup_now_success(client, monkeypatch):
    import routers.backups as backups_router

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    # Fake DB returns university name
    class _Res:
        def __init__(self, row):
            self._row = row
        def fetchone(self):
            return self._row

    class _Sess:
        def execute(self, stmt, params=None):
            return _Res(("Uni Name",))

    # Patch underlying backup function in utils.backups to return a path-like object
    class _FakePath:
        def __init__(self, name, size):
            self.name = name
            self._size = size
        def stat(self):
            class _S: pass
            s = _S()
            s.st_size = self._size
            return s

    import utils.backups as backups_utils
    monkeypatch.setattr(backups_utils, "backup_university", lambda db, unid, label=None: _FakePath("manual_abc.sql.gz", 999))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/1/create")
        assert r.status_code == 200
        body = r.json()
        assert body["filename"].endswith(".sql.gz")
        assert body["size_bytes"] == 999
        assert body["university_id"] == 1
    finally:
        app_main.app.dependency_overrides.clear()


def test_restore_to_production_success(client, monkeypatch):
    import routers.backups as backups_router

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)
    # Patch restore to return expected dict with explicit schema to avoid coupling to uid
    monkeypatch.setattr(backups_router, "restore_university", lambda db, uid, bname, to_temp=False: {
        "schema_name": "restored_schema",
        "is_temp": False,
        "production_schema": "restored_schema",
        "university_id": uid,
        "temp_university_id": None,
    })

    # DB not really used here
    class _Sess:
        pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/2/u.sql.gz/restore")
        assert r.status_code == 200
        body = r.json()
        assert body["university_id"] == 2
        assert body["backup"] == "u.sql.gz"
        assert body["is_temp"] is False
        assert body["schema_name"] == "restored_schema"
        assert "production" in body["message"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_restore_to_temp_success(client, monkeypatch):
    import routers.backups as backups_router

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(backups_router, "restore_university", lambda db, uid, bname, to_temp=False: {
        "schema_name": f"uni_{uid}_temp",
        "is_temp": True,
        "production_schema": f"uni_{uid}",
        "university_id": uid,
        "temp_university_id": 99,
    })

    class _Sess:
        pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/5/u5.sql.gz/restore", params={"to_temp": "true"})
        assert r.status_code == 200
        body = r.json()
        assert body["is_temp"] is True
        assert body["schema_name"].endswith("_temp")
        assert "temporary" in body["message"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_promote_temp_success(client, monkeypatch):
    import routers.backups as backups_router
    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(backups_router, "promote_temp_to_production", lambda db, uid: {
        "message": "Temporary schema successfully promoted to production",
        "schema_name": f"uni_{uid}",
        "university_id": uid,
    })

    class _Sess:
        pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/3/promote-temp")
        assert r.status_code == 200
        assert "promoted" in r.json()["message"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_temp_schema_success(client, monkeypatch):
    import routers.backups as backups_router
    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(backups_router, "delete_temp_schema", lambda db, uid: {
        "message": "Temporary schema deleted",
        "schema_name": f"uni_{uid}_temp",
        "university_id": uid,
    })

    class _Sess:
        pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.delete("/api/v1/backups/7/temp-schema")
        assert r.status_code == 200
        assert r.json()["schema_name"].endswith("_temp")
    finally:
        app_main.app.dependency_overrides.clear()


def test_temp_status_with_existing_temp(client, monkeypatch):
    import routers.backups as backups_router
    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    class _Res:
        def __init__(self, row=None, scalar_val=None):
            self._row = row
            self._scalar_val = scalar_val
        def fetchone(self):
            return self._row
        def scalar(self):
            return self._scalar_val

    class _Sess:
        def execute(self, stmt, params=None):
            # stmt is a sqlalchemy.sql.elements.TextClause
            sql = getattr(stmt, "text", str(stmt))
            if "FROM public.universities WHERE id =" in sql:
                # Return production schema and name
                return _Res(("uni_10", "Prod Uni"))
            if "FROM information_schema.schemata" in sql:
                # Indicate that temp schema exists
                return _Res(("uni_10_temp",))
            if "FROM public.universities WHERE schema_name =" in sql:
                # registry row for temp
                return _Res((1234,))
            if "SELECT COUNT(*) FROM uni_10_temp.faculties" in sql:
                return _Res(scalar_val=2)
            if "SELECT COUNT(*) FROM uni_10_temp.users" in sql:
                return _Res(scalar_val=5)
            return _Res()

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/backups/10/temp-status")
        assert r.status_code == 200
        body = r.json()
        assert body["has_temp_schema"] is True
        assert body["temp_university_id"] == 1234
        assert body["temp_info"]["faculty_count"] == 2
        assert body["temp_info"]["user_count"] == 5
    finally:
        app_main.app.dependency_overrides.clear()


def test_restore_backup_not_found_returns_404(client, monkeypatch):
    import routers.backups as backups_router
    from fastapi import HTTPException

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)
    # Simulate utils.restore raising FileNotFoundError -> endpoint returns 404
    def _raise(*args, **kwargs):
        raise FileNotFoundError("nope")
    monkeypatch.setattr(backups_router, "restore_university", _raise)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/9/missing.sql.gz/restore")
        assert r.status_code == 404
        assert r.json()["detail"] == "Backup not found"
    finally:
        app_main.app.dependency_overrides.clear()


def test_restore_permission_denied_returns_403(client, monkeypatch):
    import routers.backups as backups_router
    from fastapi import HTTPException, status

    def _deny(db, user, unid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    monkeypatch.setattr(backups_router, "_ensure_can_manage", _deny)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/1/any.sql.gz/restore")
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_upload_to_minio_success(client, monkeypatch, tmp_path):
    import routers.backups as backups_router
    from pathlib import Path

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    # Create temp dir and a file named backup.sql.gz
    uni_dir = tmp_path / "uni_12"
    uni_dir.mkdir(parents=True, exist_ok=True)
    backup_file = uni_dir / "b.sql.gz"
    backup_file.write_bytes(b"fake")

    # Patch the helper in utils.backups to return our temp dir and upload function to return True
    import utils.backups as backups_utils
    monkeypatch.setattr(backups_utils, "_ensure_uni_dir", lambda unid: uni_dir)
    monkeypatch.setattr(backups_router, "upload_to_minio", lambda path, uid: True)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/12/b.sql.gz/upload-to-minio")
        assert r.status_code == 200
        assert "uploaded" in r.json()["message"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_upload_to_minio_not_found_returns_404(client, monkeypatch, tmp_path):
    import routers.backups as backups_router

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    uni_dir = tmp_path / "uni_13"
    uni_dir.mkdir(parents=True, exist_ok=True)
    # Don't create the file; should 404
    import utils.backups as backups_utils
    monkeypatch.setattr(backups_utils, "_ensure_uni_dir", lambda unid: uni_dir)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/backups/13/missing.sql.gz/upload-to-minio")
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()


def test_get_all_backups_forbidden_for_non_root(client, monkeypatch, set_user):
    import routers.backups as backups_router
    from .conftest import DummyUser

    # Use dependency override to a non-root user
    set_user(DummyUser(is_root=False))

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/backups/all")
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_get_all_backups_success_for_root(client, monkeypatch, set_user):
    import routers.backups as backups_router
    from .conftest import DummyUser

    set_user(DummyUser(is_root=True))

    # Fake DB returns two active universities
    class _Res:
        def __init__(self, rows):
            self._rows = rows
        def fetchall(self):
            return self._rows

    class _Sess:
        def execute(self, stmt, params=None):
            return _Res([(1, "U1"), (2, "U2")])

    # And list_backups returns 1 entry per uni
    class _Entry:
        def __init__(self, name):
            self.name = name
            self.size_bytes = 100
            self.created_at = _dt.datetime(2024, 1, 1)
            self.in_minio = False

    monkeypatch.setattr(backups_router, "list_backups", lambda uni_id: [_Entry(f"u{uni_id}.sql.gz")])

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/backups/all")
        assert r.status_code == 200
        body = r.json()
        assert body["total_backup_count"] == 2
        assert len(body["universities"]) == 2
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_backup_success(client, monkeypatch, tmp_path):
    import routers.backups as backups_router

    # Allow operation
    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    # Create a temporary backup file structure
    uni_dir = tmp_path / "uni_21"
    uni_dir.mkdir(parents=True, exist_ok=True)
    backup_file = uni_dir / "to_delete.sql.gz"
    backup_file.write_bytes(b"data")

    # Redirect utilities to our temp dir and stub MinIO deletion
    import utils.backups as backups_utils
    monkeypatch.setattr(backups_utils, "_ensure_uni_dir", lambda unid: uni_dir)
    # Force MinIO-enabled path but stub out client removal via wrapper
    monkeypatch.setattr(backups_router, "delete_backup_file", lambda uid, name, delete_from_minio=True: {
        "university_id": uid,
        "filename": name,
        "deleted_local": True,
        "deleted_minio": True,
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.delete("/api/v1/backups/21/to_delete.sql.gz", params={"delete_from_minio": "true"})
        assert r.status_code == 200
        body = r.json()
        assert body["deleted_local"] is True
        assert body["deleted_minio"] is True
        assert body["filename"] == "to_delete.sql.gz"
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_backup_not_found_returns_404(client, monkeypatch):
    import routers.backups as backups_router

    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    # Cause underlying utility to raise FileNotFoundError
    def _raise_nf(uid, name, delete_from_minio=True):
        raise FileNotFoundError("nope")
    monkeypatch.setattr(backups_router, "delete_backup_file", _raise_nf)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.delete("/api/v1/backups/30/missing.sql.gz")
        assert r.status_code == 404
        assert r.json()["detail"] == "Backup not found"
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_backup_permission_denied_returns_403(client, monkeypatch):
    import routers.backups as backups_router
    from fastapi import HTTPException, status

    def _deny(db, user, unid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    monkeypatch.setattr(backups_router, "_ensure_can_manage", _deny)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.delete("/api/v1/backups/40/any.sql.gz")
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_backup_invalid_name_returns_400(client, monkeypatch):
    import routers.backups as backups_router

    # Allow operation but invalid name should be rejected before util call
    monkeypatch.setattr(backups_router, "_ensure_can_manage", lambda db, user, unid: None)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.delete("/api/v1/backups/50/not-a-backup.txt")
        assert r.status_code == 400
        assert r.json()["detail"].lower().startswith("invalid")
    finally:
        app_main.app.dependency_overrides.clear()
