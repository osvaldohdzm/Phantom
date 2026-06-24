"""Pruebas de lookup por herramienta cuando faltan columnas."""

from app.services.catalog_tool_index import lookup_catalog_by_tool_index


class _FakeSession:
    def execute(self, *_args, **_kwargs):
        raise RuntimeError("should not query")


def test_nmap_lookup_skips_when_column_unavailable(monkeypatch):
    monkeypatch.setattr(
        "app.services.catalog_tool_index.catalog_column_available",
        lambda _db, col: col != "NmapScriptName",
    )
    monkeypatch.setattr(
        "app.services.catalog_tool_index.vulns_catalog_table_columns",
        lambda _db: {"Id", "NessusPluginId"},
    )
    db = _FakeSession()
    assert lookup_catalog_by_tool_index(db, "nmap", "http/5357") is None
