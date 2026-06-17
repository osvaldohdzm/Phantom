"""Tests for finding grouping in Word report generation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.models.core import Finding, Severity
from app.services.docx_generator import build_finding_replacements, docx_report_generator
from app.services.finding_grouping import (
    group_findings_for_report,
    sort_grouped_rows_for_report,
)


def _make_finding(
    *,
    titulo: str,
    severidad: Severity = Severity.high,
    componente: str = "",
    raw_output: str = "",
) -> Finding:
    return Finding(
        id=uuid.uuid4(),
        titulo=titulo,
        severidad=severidad,
        componente_afectado=componente,
        raw_tool_output=raw_output,
        created_at=datetime.now(timezone.utc),
    )


def test_group_three_same_title_different_hosts():
    findings = [
        _make_finding(
            titulo="SQL Injection",
            componente="host-a.example.com",
            raw_output="output A line one",
        ),
        _make_finding(
            titulo="SQL Injection",
            componente="host-b.example.com",
            raw_output="output B line one",
        ),
        _make_finding(
            titulo="SQL Injection",
            componente="host-c.example.com",
            raw_output="output C line one",
        ),
    ]

    rows = group_findings_for_report(findings)
    assert len(rows) == 1
    row = rows[0]
    assert len(row.member_ids) == 3

    components = row.merged_componente_afectado.split("\n")
    assert components == [
        "host-a.example.com",
        "host-b.example.com",
        "host-c.example.com",
    ]

    assert row.merged_raw_tool_output.count("-----[Salida correspondiente a:") == 3
    assert "host-a.example.com" in row.merged_raw_tool_output
    assert "output A line one" in row.merged_raw_tool_output
    assert "output B line one" in row.merged_raw_tool_output
    assert "output C line one" in row.merged_raw_tool_output


def test_different_severity_not_grouped():
    findings = [
        _make_finding(titulo="XSS", severidad=Severity.high, componente="a"),
        _make_finding(titulo="XSS", severidad=Severity.medium, componente="b"),
    ]
    rows = group_findings_for_report(findings)
    assert len(rows) == 2


def test_title_normalization_groups_case_and_whitespace():
    findings = [
        _make_finding(titulo="  Open Redirect ", componente="a"),
        _make_finding(titulo="open redirect", componente="b"),
    ]
    rows = group_findings_for_report(findings)
    assert len(rows) == 1
    assert row_components(rows[0]) == ["a", "b"]


def row_components(row) -> list[str]:
    return row.merged_componente_afectado.split("\n")


def test_single_finding_unchanged():
    findings = [_make_finding(titulo="Only one", componente="solo", raw_output="scan result")]
    rows = group_findings_for_report(findings)
    assert len(rows) == 1
    replacements = build_finding_replacements(
        rows[0].representative,
        merged_componente=rows[0].merged_componente_afectado,
        merged_raw_output=rows[0].merged_raw_tool_output,
    )
    assert replacements["«SISTEMA(S) O RUTA(S) AFECTADOS»"] == "solo"
    assert "scan result" in replacements["«Salidas de herramienta»"]


def test_group_by_nessus_plugin_id_despite_different_titles():
    findings = [
        _make_finding(
            titulo="Protocolo TLS Versión 1.1 Obsoleto",
            raw_output="[Nessus CSV] Plugin ID: 157288\nHost: 10.0.0.1\n\nPlugin output:\nTLS 1.1",
            componente="10.0.0.1",
        ),
        _make_finding(
            titulo="Compatible con protocolo de transporte inseguro (TLS 1.1)",
            raw_output="[Nessus CSV] Plugin ID: 157288\nHost: 10.0.0.2\n\nPlugin output:\nTLS 1.1",
            componente="10.0.0.2",
        ),
    ]
    rows = group_findings_for_report(findings)
    assert len(rows) == 1
    assert len(rows[0].member_ids) == 2


def test_legacy_nessus_wrapper_stripped_from_salidas():
    """Salidas = solo Plugin Output limpio, sin metadatos de auto-ingesta."""
    findings = [
        _make_finding(
            titulo="TLS 1.1",
            componente="10.0.0.1",
            raw_output=(
                "[Nessus CSV] Plugin ID: 157288\nHost: 10.0.0.1\n\n"
                "Plugin output:\nTLS 1.1 enabled on port 443"
            ),
        ),
    ]
    rows = group_findings_for_report(findings)
    salidas = rows[0].merged_raw_tool_output
    assert "-----[Salida correspondiente a: 10.0.0.1 ]-----" in salidas
    assert "TLS 1.1 enabled on port 443" in salidas
    assert "Plugin ID" not in salidas
    assert "[Nessus CSV]" not in salidas
    assert "Host:" not in salidas

    replacements = build_finding_replacements(
        rows[0].representative,
        merged_componente=rows[0].merged_componente_afectado,
        merged_raw_output=rows[0].merged_raw_tool_output,
    )
    word_salidas = replacements["«Salidas de herramienta»"]
    assert word_salidas == salidas
    assert "Plugin ID" not in word_salidas


def test_merged_salidas_not_double_cleaned():
    """Prefijos por componente y líneas cortas no se pierden al exportar Word."""
    short_line = "TLSv1.1"
    findings = [
        _make_finding(titulo="Weak TLS", componente="host-a", raw_output=short_line),
        _make_finding(titulo="Weak TLS", componente="host-b", raw_output=short_line),
    ]
    rows = group_findings_for_report(findings)
    salidas = rows[0].merged_raw_tool_output
    assert salidas.count("-----[Salida correspondiente a:") == 2
    assert salidas.count(f"\n{short_line}") == 2

    replacements = build_finding_replacements(
        rows[0].representative,
        merged_raw_output=rows[0].merged_raw_tool_output,
    )
    assert replacements["«Salidas de herramienta»"] == salidas


def test_sort_grouped_rows_by_severity_then_alphabetic_title():
    findings = [
        _make_finding(titulo="Zebra issue", severidad=Severity.info),
        _make_finding(titulo="Beta vuln", severidad=Severity.high),
        _make_finding(titulo="Alpha vuln", severidad=Severity.high),
        _make_finding(titulo="Critical RCE", severidad=Severity.critical),
    ]
    rows = sort_grouped_rows_for_report(group_findings_for_report(findings))
    assert [r.representative.titulo for r in rows] == [
        "Critical RCE",
        "Alpha vuln",
        "Beta vuln",
        "Zebra issue",
    ]


def test_generate_batch_produces_one_doc_for_grouped():
    findings = [
        _make_finding(titulo="Weak Cipher", componente="srv1", raw_output="cipher list 1"),
        _make_finding(titulo="Weak Cipher", componente="srv2", raw_output="cipher list 2"),
        _make_finding(titulo="Weak Cipher", componente="srv3", raw_output="cipher list 3"),
    ]
    template = (
        "/Users/osvaldohm/Desktop/apps/spectre/backend/.venv/lib/python3.9/"
        "site-packages/docx/templates/default.docx"
    )
    result = docx_report_generator.generate_batch(
        template_path=template,
        findings=findings,
        assets_map={},
        job_id=uuid.uuid4(),
    )
    assert result["findings_count"] == 3
    assert result["grouped_count"] == 1
    assert len(result["individual_paths"]) == 1
