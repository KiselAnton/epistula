import re

from utils.data_transfer_versioning import (
    compare_versions,
    read_backend_app_version,
    migrate_entities,
)


def test_compare_versions_orders_correctly():
    assert compare_versions("1.0", "1.0") == 0
    assert compare_versions("1.0", "1.1") == -1
    assert compare_versions("1.2.3", "1.2.0") == 1
    assert compare_versions("2.0", "1.9.9") == 1
    assert compare_versions("", "0.0.1") == -1


def test_read_backend_app_version_non_empty():
    v = read_backend_app_version()
    assert isinstance(v, str) and len(v) > 0
    # basic semver-like pattern
    assert re.match(r"^\d+\.\d+\.\d+$", v) is not None


def test_migrate_entities_noop_for_same_version():
    data = [{"id": 1, "name": "A"}]
    out = migrate_entities("faculties", data, "1.0", "1.0")
    assert out == data
