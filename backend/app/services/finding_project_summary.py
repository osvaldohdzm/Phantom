"""Resumen agregado de hallazgos por proyecto (sin enviar todos al cliente)."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.core import Finding, Severity
from app.services.finding_duplicates import duplicate_stats, normalize_affected_component
from app.services.finding_grouping import grouping_key

_HOST_RE = re.compile(r"^Host:\s*(.+)$", re.MULTILINE | re.IGNORECASE)
_PORT_RE = re.compile(r"^Puerto:\s*(.+)$", re.MULTILINE | re.IGNORECASE)


def _is_info(sev: Severity) -> bool:
    return sev == Severity.info


def _resolve_componente(finding: Finding) -> str:
    direct = (finding.componente_afectado or "").strip()
    if direct:
        return direct
    raw = finding.raw_tool_output or ""
    host_m = _HOST_RE.search(raw)
    if not host_m:
        return ""
    host = host_m.group(1).strip()
    port_m = _PORT_RE.search(raw)
    if port_m:
        port = port_m.group(1).strip()
        if port and port not in ("0", "none"):
            return f"{host}:{port}"
    return host


def build_project_summary(db: Session, engagement_id) -> dict[str, Any]:
    findings = (
        db.query(Finding).filter(Finding.engagement_id == engagement_id).order_by(Finding.created_at.desc()).all()
    )
    total = len(findings)

    by_severity: dict[str, int] = {s.value: 0 for s in Severity}
    for f in findings:
        by_severity[f.severidad.value] = by_severity.get(f.severidad.value, 0) + 1

    total_excl_info = sum(1 for f in findings if not _is_info(f.severidad))

    components: list[str] = []
    hosts: set[str] = set()
    for f in findings:
        c = normalize_affected_component(_resolve_componente(f))
        if c:
            components.append(c)
            hosts.add(c.split(":")[0])

    group_buckets: dict[tuple, list[Finding]] = {}
    for f in findings:
        gk = grouping_key(f)
        group_buckets.setdefault(gk, []).append(f)

    grouped_all = len(group_buckets)
    grouped_excl_info = sum(1 for members in group_buckets.values() if members and not _is_info(members[0].severidad))

    grouped_components = 0
    breakdown: list[dict[str, Any]] = []
    for members in group_buckets.values():
        if not members:
            continue
        comps = list({normalize_affected_component(_resolve_componente(m)) for m in members if _resolve_componente(m)})
        comps = [c for c in comps if c]
        grouped_components += len(comps)
        if _is_info(members[0].severidad):
            continue
        breakdown.append(
            {
                "titulo": members[0].titulo,
                "severidad": members[0].severidad.value,
                "member_count": len(members),
                "component_count": len(comps),
            }
        )

    breakdown.sort(key=lambda r: (-r["component_count"], r["titulo"]))

    dup = duplicate_stats(findings)

    return {
        "total_findings": total,
        "total_excluding_info": total_excl_info,
        "unique_components": len(set(components)),
        "unique_hosts": len(hosts),
        "component_occurrences": len(components),
        "grouped_vulnerability_count": grouped_all,
        "grouped_vulnerability_count_excluding_info": grouped_excl_info,
        "grouped_component_total": grouped_components,
        "by_severity": by_severity,
        "by_severity_excluding_info": {
            k: v for k, v in by_severity.items() if k != Severity.info.value
        },
        "compression_ratio": round(total / grouped_all, 1) if grouped_all else float(total),
        "vulnerability_breakdown": breakdown,
        "duplicates": dup,
    }
