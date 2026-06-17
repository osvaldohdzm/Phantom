"""Detección de hallazgos duplicados (mismo título + mismo componente)."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from app.models.core import Finding
from app.services.finding_grouping import normalize_grouping_title
from app.services.text_encoding import extract_nessus_plugin_id

_HOST_RE = re.compile(r"^Host:\s*(.+)$", re.MULTILINE | re.IGNORECASE)
_PORT_RE = re.compile(r"^Puerto:\s*(.+)$", re.MULTILINE | re.IGNORECASE)


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


def normalize_affected_component(raw: str) -> str:
    trimmed = (raw or "").strip()
    if not trimmed:
        return ""
    s = trimmed.lower()
    if "://" in s:
        try:
            u = urlparse(s)
            host = (u.hostname or "").lower()
            port = u.port or (443 if u.scheme == "https" else 80 if u.scheme == "http" else None)
            path = u.path.rstrip("/") if u.path and u.path != "/" else ""
            if port and port not in (80, 443):
                return f"{host}:{port}{path}"
            return f"{host}{path}" if path else host
        except Exception:
            pass
    return s.replace(" ", "").rstrip("/")


def duplicate_key(finding: Finding) -> str:
    title = normalize_grouping_title(finding.titulo)
    comp = normalize_affected_component(_resolve_componente(finding))
    return f"{title}\0{comp}"


def _completeness_score(finding: Finding) -> int:
    fields = [
        finding.descripcion,
        finding.amenaza_ampliada,
        finding.propuesta_remediacion,
        finding.referencias,
        finding.componente_afectado,
        finding.metodo_deteccion,
        finding.explicacion_tecnica,
        finding.raw_tool_output,
    ]
    filled = sum(1 for f in fields if f and len(str(f).strip()) >= 5)
    score = filled * 10
    if finding.catalog_id:
        score += 5
    if finding.cve:
        score += 2
    return score


def find_duplicate_groups(findings: list[Finding]) -> list[dict[str, Any]]:
    buckets: dict[str, list[Finding]] = {}
    for f in findings:
        title = normalize_grouping_title(f.titulo)
        if not title:
            continue
        comp = normalize_affected_component(_resolve_componente(f))
        if not comp:
            continue
        key = duplicate_key(f)
        buckets.setdefault(key, []).append(f)

    groups: list[dict[str, Any]] = []
    for key, members in buckets.items():
        if len(members) < 2:
            continue
        keep = sorted(
            members,
            key=lambda m: (-_completeness_score(m), m.created_at.isoformat() if m.created_at else ""),
        )[0]
        remove = [m for m in members if m.id != keep.id]
        groups.append(
            {
                "key": key,
                "titulo": keep.titulo,
                "componente": _resolve_componente(keep),
                "keep_id": str(keep.id),
                "remove_ids": [str(m.id) for m in remove],
                "total_in_group": len(members),
            }
        )
    groups.sort(key=lambda g: len(g["remove_ids"]), reverse=True)
    return groups


def duplicate_stats(findings: list[Finding]) -> dict[str, Any]:
    groups = find_duplicate_groups(findings)
    remove_count = sum(len(g["remove_ids"]) for g in groups)
    return {
        "group_count": len(groups),
        "remove_count": remove_count,
        "groups_preview": groups[:12],
    }
