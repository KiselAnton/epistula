"""Versioning utilities for data-transfer export/import payloads.

Provides:
- Current export format version and minimum supported import version
- Reading backend app version from VERSION file
- Simple semver comparison (major.minor[.patch])
- Migration hook to transform older exported records to current format

Note: Initially, there are no transformations needed between versions.
"""

from __future__ import annotations

from typing import List, Dict, Any

import os


# Semver strings for the data-transfer payload format
CURRENT_FORMAT_VERSION = "1.0"
MIN_SUPPORTED_IMPORT_VERSION = "1.0"


def read_backend_app_version() -> str:
    """Reads backend app version from VERSION file placed next to backend app.

    Falls back to "0.0.0" if file cannot be read.
    """
    here = os.path.dirname(os.path.dirname(__file__))  # .../backend
    version_file = os.path.join(here, "VERSION")
    try:
        with open(version_file, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "0.0.0"


def _parse_semver(v: str) -> tuple[int, int, int]:
    parts = (v or "0").split(".")
    try:
        major = int(parts[0]) if len(parts) > 0 else 0
        minor = int(parts[1]) if len(parts) > 1 else 0
        patch = int(parts[2]) if len(parts) > 2 else 0
        return major, minor, patch
    except ValueError:
        # Treat invalid strings as 0.0.0
        return (0, 0, 0)


def compare_versions(a: str, b: str) -> int:
    """Compares two semver-like strings.

    Returns:
    -1 if a < b, 0 if a == b, 1 if a > b
    """
    a_t = _parse_semver(a)
    b_t = _parse_semver(b)
    return (a_t > b_t) - (a_t < b_t)


def migrate_entities(entity_type: str, data: List[Dict[str, Any]], from_version: str, to_version: str) -> List[Dict[str, Any]]:
    """Transforms entity records from an older export format to the current one.

    If no migration is necessary, returns the data unchanged.

    Parameters:
        entity_type: Entity type name (e.g., "faculties")
        data: List of records as dictionaries
        from_version: Source format version
        to_version: Target format version

    Returns:
        List[Dict[str, Any]]: transformed data suitable for current importer.
    """
    # For now (v1.0), there are no breaking changes between versions.
    # Future example:
    # if compare_versions(from_version, "1.1") < 0 <= compare_versions(to_version, "1.1"):
    #     # apply transformations introduced in 1.1
    #     ...
    return data
