"""Agrupa hallazgos por título + severidad para reportes Word (Power Query / VBA)."""

from __future__ import annotations

import re
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Optional

from app.models.core import Asset, Finding, Severity
from app.services.report_text_preprocess import preprocess_report_field, salida_herramienta_for_report
from app.services.catalog_tool_index import normalize_tool_source, resolve_finding_tool_identity
from app.services.text_encoding import extract_nessus_plugin_id

SALIDA_PREFIX_TEMPLATE = "-----[Salida correspondiente a: {componente} ]-----"
_HOST_RE = re.compile(r"^Host:\s*(.+)$", re.MULTILINE | re.IGNORECASE)
_PORT_RE = re.compile(r"^Puerto:\s*(.+)$", re.MULTILINE | re.IGNORECASE)


def normalize_grouping_title(titulo: str) -> str:
    """Clave de agrupación: trim + comparación sin distinguir mayúsculas."""
    return (titulo or "").strip().casefold()


def grouping_key(finding: Finding) -> tuple[str, ...]:
    """Índice herramienta (tipo origen + id) o título normalizado + severidad."""
    src, vid = resolve_finding_tool_identity(finding)
    if vid and normalize_tool_source(src) != "manual":
        return (
            "tool",
            normalize_tool_source(src),
            vid,
            finding.severidad.value if finding.severidad else "",
        )
    plugin = extract_nessus_plugin_id(finding.raw_tool_output)
    if plugin:
        return ("plugin", plugin, finding.severidad.value if finding.severidad else "")
    return ("title", normalize_grouping_title(finding.titulo), finding.severidad.value if finding.severidad else "")


def _host_from_raw(raw: str) -> str:
    host_match = _HOST_RE.search(raw)
    if not host_match:
        return ""
    host = host_match.group(1).strip()
    port_match = _PORT_RE.search(raw)
    if port_match:
        port = port_match.group(1).strip()
        if port and port not in ("0", "none"):
            return f"{host}:{port}"
    return host


def _resolve_componente_raw(finding: Finding, asset: Optional[Asset]) -> str:
    raw = (finding.componente_afectado or "").strip()
    if not raw and finding.raw_tool_output:
        raw = _host_from_raw(finding.raw_tool_output)
    if not raw and asset:
        raw = (asset.fqdn or asset.nombre or "").strip()
    return raw


def _clean_componente(finding: Finding, asset: Optional[Asset]) -> str:
    return preprocess_report_field(
        _resolve_componente_raw(finding, asset), strip_bullets=True, capitalize=False
    )


def _personalized_salida(componente: str, tool_output: str) -> str:
    cleaned = salida_herramienta_for_report(tool_output or "")
    if not cleaned:
        return ""
    label = componente or "N/A"
    prefix = SALIDA_PREFIX_TEMPLATE.format(componente=label)
    return f"{prefix}\n{cleaned}"


def _first_non_empty(findings: list[Finding], attr: str) -> Optional[str]:
    for finding in findings:
        value = getattr(finding, attr, None)
        if value is not None and str(value).strip():
            return str(value)
    return None


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(key)
    return result


@dataclass
class GroupedReportRow:
    """Fila consolidada para una tabla Word."""

    representative: Finding
    members: list[Finding] = field(default_factory=list)
    member_ids: list[uuid.UUID] = field(default_factory=list)
    merged_componente_afectado: str = ""
    merged_raw_tool_output: str = ""


def group_findings_for_report(
    findings: list[Finding],
    assets_map: Optional[dict[uuid.UUID, Asset]] = None,
) -> list[GroupedReportRow]:
    """Agrupa hallazgos con el mismo título (normalizado) y severidad."""
    if not findings:
        return []

    assets_map = assets_map or {}
    buckets: OrderedDict[tuple[str, Severity], list[tuple[Finding, Optional[Asset]]]] = (
        OrderedDict()
    )

    for finding in findings:
        asset = assets_map.get(finding.asset_id) if finding.asset_id else None
        key = grouping_key(finding)
        buckets.setdefault(key, []).append((finding, asset))

    rows: list[GroupedReportRow] = []
    for members_with_assets in buckets.values():
        members = [f for f, _ in members_with_assets]
        components: list[str] = []
        salidas: list[str] = []

        for finding, asset in members_with_assets:
            componente = _clean_componente(finding, asset)
            if componente:
                components.append(componente)
            salida = _personalized_salida(componente, finding.raw_tool_output or "")
            if salida:
                salidas.append(salida)

        representative = members[0]
        merged_componente = "\n".join(_unique_preserve_order(components))
        merged_salida = "\n".join(salidas)

        rows.append(
            GroupedReportRow(
                representative=representative,
                members=members,
                member_ids=[f.id for f in members],
                merged_componente_afectado=merged_componente,
                merged_raw_tool_output=merged_salida,
            )
        )

    return rows


def first_non_empty_field(findings: list[Finding], attr: str) -> Optional[str]:
    return _first_non_empty(findings, attr)


SEVERITY_ORDER: dict[Severity, int] = {
    Severity.critical: 0,
    Severity.high: 1,
    Severity.medium: 2,
    Severity.low: 3,
    Severity.info: 4,
}


def severity_sort_key(finding: Finding) -> tuple[int, str]:
    """Clave de orden: severidad (CRÍTICA primero) y título A-Z sin distinguir mayúsculas."""
    sev = finding.severidad or Severity.medium
    order = SEVERITY_ORDER.get(sev, 99)
    return order, normalize_grouping_title(finding.titulo or "")


def sort_grouped_rows_by_severity(rows: list[GroupedReportRow]) -> list[GroupedReportRow]:
    """Ordena filas agrupadas: severidad descendente y título alfabético."""
    return sort_grouped_rows_for_report(rows)


def sort_grouped_rows_for_report(rows: list[GroupedReportRow]) -> list[GroupedReportRow]:
    """CRÍTICA → ALTA → MEDIA → BAJA → INFORMATIVA; dentro de cada nivel, A-Z."""
    if len(rows) <= 1:
        return rows
    return sorted(rows, key=lambda row: severity_sort_key(row.representative))


def prepare_grouped_rows_for_report(
    findings: list[Finding],
    assets_map: Optional[dict[uuid.UUID, Asset]] = None,
) -> list[GroupedReportRow]:
    """Agrupa hallazgos y devuelve filas listas para Word (ordenadas)."""
    return sort_grouped_rows_for_report(group_findings_for_report(findings, assets_map))
