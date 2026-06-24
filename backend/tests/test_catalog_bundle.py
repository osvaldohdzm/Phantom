"""Pruebas del bundle de catálogo operativo (sin BD)."""

from app.services.catalog_bundle import bundled_is_newer, load_manifest


def test_bundled_is_newer_by_version():
    assert bundled_is_newer("unknown", "v2026.06.1")
    assert bundled_is_newer("v2026.06.0", "v2026.06.1")
    assert not bundled_is_newer("v2026.06.2", "v2026.06.1")


def test_load_manifest_exists():
    manifest = load_manifest()
    assert manifest is not None
    assert "version" in manifest
    assert "revision" in manifest
