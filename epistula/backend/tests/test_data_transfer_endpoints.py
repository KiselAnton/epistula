import datetime as _dt
import copy


def test_export_entities_success(client, monkeypatch):
    import routers.data_transfer as dt_router

    # Allow permissions and fix schema
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_x")

    # Patch export utility
    monkeypatch.setattr(dt_router, "export_entity", lambda db, schema, etype, ids: {
        "entity_type": etype,
        "source_schema": schema,
        "count": 1,
        "exported_at": _dt.datetime(2024,1,1).isoformat(),
        "data": [{"id": 1, "name": "A"}],
        "columns": ["id", "name"],
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/1/export", json={
            "entity_type": "faculties",
            "entity_ids": [1]
        })
        assert r.status_code == 200
        body = r.json()
        assert body["entity_type"] == "faculties"
        assert body["source_schema"] == "schema_x"
        assert body["count"] == 1
    finally:
        app_main.app.dependency_overrides.clear()


def test_export_subject_students_success(client, monkeypatch):
    import routers.data_transfer as dt_router

    # Allow permissions and fix schema
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_x")

    # Patch export utility
    monkeypatch.setattr(dt_router, "export_entity", lambda db, schema, etype, ids: {
        "entity_type": etype,
        "source_schema": schema,
        "count": 2,
        "exported_at": _dt.datetime(2024,1,1).isoformat(),
        "data": [{"id": 1, "subject_id": 9, "student_id": 101}, {"id": 2, "subject_id": 9, "student_id": 102}],
        "columns": ["id", "subject_id", "student_id"],
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/1/export", json={
            "entity_type": "subject_students",
            "entity_ids": None
        })
        assert r.status_code == 200
        body = r.json()
        assert body["entity_type"] == "subject_students"
        assert body["count"] == 2
    finally:
        app_main.app.dependency_overrides.clear()


def test_export_entities_invalid_type_returns_400(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/1/export", json={
            "entity_type": "not_an_entity"
        })
        assert r.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()


def test_export_entities_from_temp_missing_schema_returns_404(client, monkeypatch):
    import routers.data_transfer as dt_router
    from fastapi import HTTPException, status

    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    # Simulate _get_schema_name raising 404 when temp missing
    def _get_schema_name(db, uid, use_temp=False):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Temporary schema does not exist. Please restore a backup to temp first.")
    monkeypatch.setattr(dt_router, "_get_schema_name", _get_schema_name)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/1/export", json={
            "entity_type": "faculties",
            "from_temp": True
        })
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()


def test_export_faculty_full_success(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_z")
    monkeypatch.setattr(dt_router, "export_faculty_with_relations", lambda db, schema, fid: {"faculty_id": fid, "source_schema": schema, "relations": {}})

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/data-transfer/2/export/faculty/33")
        assert r.status_code == 200
        body = r.json()
        assert body["faculty_id"] == 33
        assert body["source_schema"] == "schema_z"
    finally:
        app_main.app.dependency_overrides.clear()


def test_export_faculty_full_not_found_returns_404(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_z")
    def _raise(db, schema, fid):
        raise ValueError("Faculty 33 not found")
    monkeypatch.setattr(dt_router, "export_faculty_with_relations", _raise)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/data-transfer/2/export/faculty/33")
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()


def test_import_entities_success(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_y")
    monkeypatch.setattr(dt_router, "import_entity", lambda db, schema, etype, data, strategy='merge': {
        "entity_type": etype, "target_schema": schema, "strategy": strategy,
        "imported": 1, "updated": 0, "skipped": 0, "errors": [], "total_processed": len(data)
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/2/import", json={
            "entity_type": "subjects",
            "data": [{"id": 1, "name": "S"}],
            "strategy": "merge",
            "format_version": "1.0"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["entity_type"] == "subjects"
        assert body["target_schema"] == "schema_y"
        assert body["imported"] == 1
    finally:
        app_main.app.dependency_overrides.clear()


def test_import_subject_students_success(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_y")
    monkeypatch.setattr(dt_router, "import_entity", lambda db, schema, etype, data, strategy='merge': {
        "entity_type": etype, "target_schema": schema, "strategy": strategy,
        "imported": len(data), "updated": 0, "skipped": 0, "errors": [], "total_processed": len(data)
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/2/import", json={
            "entity_type": "subject_students",
            "data": [{"id": 1, "subject_id": 9, "student_id": 101}],
            "strategy": "merge",
            "format_version": "1.0"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["entity_type"] == "subject_students"
        assert body["target_schema"] == "schema_y"
        assert body["imported"] == 1
    finally:
        app_main.app.dependency_overrides.clear()


def test_import_entities_invalid_type_returns_400(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/2/import", json={
            "entity_type": "nope",
            "data": []
        })
        assert r.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()


def test_import_faculty_full_success(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_imp")
    monkeypatch.setattr(dt_router, "import_faculty_with_relations", lambda db, schema, data, strategy='merge': {"ok": True, "target_schema": schema, "strategy": strategy})

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/data-transfer/3/import/faculty", json={"faculty": {"id": 1}, "relations": {}})
        assert r.status_code == 200
        assert r.json()["target_schema"] == "schema_imp"
    finally:
        app_main.app.dependency_overrides.clear()


def test_export_entities_includes_version(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_v")
    monkeypatch.setattr(dt_router, "export_entity", lambda db, schema, etype, ids: {
        "format_version": "1.0",
        "app_version": "0.1.0",
        "entity_type": etype,
        "source_schema": schema,
        "count": 1,
        "exported_at": _dt.datetime(2024,1,1).isoformat(),
        "data": [{"id": 1, "name": "A"}],
        "columns": ["id", "name"],
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/data-transfer/9/export", json={"entity_type": "faculties"})
        assert r.status_code == 200
        body = r.json()
        assert body["format_version"] == "1.0"
        assert "app_version" in body
    finally:
        app_main.app.dependency_overrides.clear()


def test_import_rejects_too_new_version(client, monkeypatch):
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_new")
    monkeypatch.setattr(dt_router, "import_entity", lambda db, schema, etype, data, strategy='merge': {
        "entity_type": etype, "target_schema": schema, "strategy": strategy,
        "imported": len(data), "updated": 0, "skipped": 0, "errors": [], "total_processed": len(data)
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/data-transfer/5/import", json={
            "entity_type": "faculties",
            "data": [{"id": 1, "name": "A"}],
            "strategy": "merge",
            "format_version": "2.0"  # newer major
        })
        assert r.status_code == 400
        assert "newer" in r.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_import_migrates_older_version(client, monkeypatch):
    # Simulate migration by monkeypatching migrate_entities to alter data
    import routers.data_transfer as dt_router
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_mig")

    def _fake_migrate(entity_type, data, from_v, to_v):
        # Add synthetic field when migrating from 0.9 to 1.0
        if from_v == "0.9" and to_v == "1.0":
            new_data = []
            for row in data:
                r = copy.deepcopy(row)
                r["_migrated"] = True
                new_data.append(r)
            return new_data
        return data
    monkeypatch.setattr(dt_router, "migrate_entities", _fake_migrate)

    monkeypatch.setattr(dt_router, "import_entity", lambda db, schema, etype, data, strategy='merge': {
        "entity_type": etype, "target_schema": schema, "strategy": strategy,
        "imported": len([d for d in data if d.get("_migrated")]),
        "updated": 0, "skipped": 0, "errors": [], "total_processed": len(data)
    })

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/data-transfer/6/import", json={
            "entity_type": "subjects",
            "data": [{"id": 1, "name": "S"}],
            "strategy": "merge",
            "format_version": "0.9"
        })
        assert r.status_code == 200
        body = r.json()
        # Confirm migrated flag caused imported count to reflect migration effect
        assert body["imported"] == 1
        assert body["total_processed"] == 1
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_available_entities_success(client, monkeypatch):
    import routers.data_transfer as dt_router
    from utils.data_transfer import ENTITY_TYPES
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: None)
    monkeypatch.setattr(dt_router, "_get_schema_name", lambda db, uid, use_temp=False: "schema_list")

    class _Res:
        def __init__(self, scalar_val=0):
            self._scalar_val = scalar_val
        def scalar(self):
            return self._scalar_val

    class _Sess:
        def execute(self, stmt, params=None):
            # Return count 2 for each table
            return _Res(scalar_val=2)

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/data-transfer/4/entities")
        assert r.status_code == 200
        body = r.json()
        assert body["schema_name"] == "schema_list"
        assert set(body["entities"].keys()) == set(ENTITY_TYPES)
        assert body["total_entities"] == 2 * len(ENTITY_TYPES)
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_available_entities_permission_denied(client, monkeypatch):
    import routers.data_transfer as dt_router
    from fastapi import HTTPException, status
    monkeypatch.setattr(dt_router, "_ensure_can_manage", lambda db, user, unid: (_ for _ in ()).throw(HTTPException(status_code=status.HTTP_403_FORBIDDEN)))

    class _Sess: pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/data-transfer/4/entities")
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()
