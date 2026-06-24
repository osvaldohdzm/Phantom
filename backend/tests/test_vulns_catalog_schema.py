"""Pruebas de columnas dinámicas en core.vulns_catalog."""

from app.services.vulns_catalog_schema import (
    DESIRED_CATALOG_LOOKUP_COLUMNS,
    invalidate_vulns_catalog_schema_cache,
    vulns_catalog_lookup_select_clause,
)


class _FakeMappings:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return _FakeMappings(self._rows)


class _FakeSession:
    def __init__(self, columns: set[str]):
        self._columns = columns

    def execute(self, _stmt, _params=None):
        return _FakeResult([{"column_name": c} for c in sorted(self._columns)])


def test_lookup_select_skips_missing_columns():
    invalidate_vulns_catalog_schema_cache()
    db = _FakeSession({"Id", "NessusPluginId", "EspNombreVulnerabilidadUnificado"})
    clause = vulns_catalog_lookup_select_clause(db)
    assert '"Id"' in clause
    assert '"NessusPluginId"' in clause
    assert '"SourceDetection"' not in clause
    assert '"EspNombreVulnerabilidadUnificado"' in clause


def test_desired_columns_include_source_detection():
    assert "SourceDetection" in DESIRED_CATALOG_LOOKUP_COLUMNS
