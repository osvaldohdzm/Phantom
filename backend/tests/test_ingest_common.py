from app.services.ingest_common import resolve_finding_catalog_fk


def test_resolve_finding_catalog_fk_rejects_unknown_id():
    assert resolve_finding_catalog_fk("13046", {1, 2, 3}) is None


def test_resolve_finding_catalog_fk_accepts_valid_id():
    assert resolve_finding_catalog_fk("17", {17, 42}) == 17


def test_resolve_finding_catalog_fk_invalid_values():
    assert resolve_finding_catalog_fk(None, set()) is None
    assert resolve_finding_catalog_fk("", set()) is None
    assert resolve_finding_catalog_fk("abc", set()) is None
