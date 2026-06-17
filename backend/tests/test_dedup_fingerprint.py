from app.models.core import Finding, Severity
from app.services.dedup_fingerprint import build_dedup_fingerprint


def _finding(**kwargs) -> Finding:
    f = Finding(titulo="Test", severidad=Severity.medium, **kwargs)
    return f


def test_dedup_fingerprint_cve_and_asset():
    fp = build_dedup_fingerprint(
        _finding(cve="CVE-2024-1", componente_afectado="10.0.0.1:443")
    )
    assert fp == "cve:CVE-2024-1|asset:10.0.0.1:443"


def test_dedup_fingerprint_plugin():
    fp = build_dedup_fingerprint(
        _finding(tool_vuln_id="19506", componente_afectado="host.example.com")
    )
    assert fp.startswith("plugin:19506|asset:")
