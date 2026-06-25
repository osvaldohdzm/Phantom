"""Pruebas del bundle de catálogo operativo (sin BD)."""

from app.services.catalog_bundle import (
    bundled_is_newer,
    load_manifest,
    resolve_export_notes,
    resolve_export_revision,
    resolve_export_version,
)


def test_bundled_is_newer_by_version():
    assert bundled_is_newer("unknown", "v2026.06.1")
    assert bundled_is_newer("v2026.06.0", "v2026.06.1")
    assert not bundled_is_newer("v2026.06.2", "v2026.06.1")


def test_load_manifest_exists():
    manifest = load_manifest()
    assert manifest is not None
    assert "version" in manifest
    assert "revision" in manifest


def test_resolve_export_version_explicit():
    assert resolve_export_version("v2026.06.1") == "v2026.06.1"


def test_resolve_export_revision_increments():
    assert resolve_export_revision(None) >= 1
    assert resolve_export_revision(7) == 7


def test_resolve_export_notes_default():
    notes = resolve_export_notes(None, version="v2026.06.1", revision=3)
    assert "revisión 3" in notes
    assert "v2026.06.1" in notes


def test_resolve_export_notes_custom():
    assert resolve_export_notes("Mi nota", version="v1", revision=1) == "Mi nota"
