"""Pruebas del índice catálogo por herramienta."""

from types import SimpleNamespace

from app.services.catalog_tool_index import (
    catalog_column_for_source,
    normalize_tool_source,
    resolve_finding_tool_identity,
)


def test_normalize_tool_source_aliases():
    assert normalize_tool_source("Nessus") == "nessus"
    assert normalize_tool_source("OWASP ZAP") == "owaspzap"
    assert normalize_tool_source("VulnerabilityManagerPlus") == "vulnerabilitymanagerplus"


def test_catalog_column_for_nessus():
    assert catalog_column_for_source("Nessus") == "NessusPluginId"
    assert catalog_column_for_source("Nmap") == "NmapScriptName"
    assert catalog_column_for_source("Acunetix") == "AcunetixName"


def test_resolve_finding_tool_identity_from_persisted_fields():
    finding = SimpleNamespace(
        tool_source="Nessus",
        tool_vuln_id="20007",
        raw_tool_output="",
        titulo="SSL",
    )
    assert resolve_finding_tool_identity(finding) == ("nessus", "20007")


def test_resolve_finding_tool_identity_from_raw_plugin():
    finding = SimpleNamespace(
        tool_source=None,
        tool_vuln_id=None,
        raw_tool_output="Plugin ID: 157288\nHost: 10.0.0.1",
        titulo="TLS",
    )
    assert resolve_finding_tool_identity(finding) == ("nessus", "157288")
