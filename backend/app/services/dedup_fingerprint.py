"""Llave compuesta para deduplicación: activo + CVE / Plugin ID / título."""

from __future__ import annotations

import hashlib

from app.models.core import Finding
from app.services.catalog_tool_index import resolve_finding_tool_identity
from app.services.finding_duplicates import duplicate_key, normalize_affected_component
from app.services.text_encoding import extract_nessus_plugin_id


def _resolve_component(finding: Finding) -> str:
    direct = (finding.componente_afectado or "").strip()
    if direct:
        return normalize_affected_component(direct)
    from app.services.finding_duplicates import _resolve_componente

    return normalize_affected_component(_resolve_componente(finding))


def build_dedup_fingerprint_from_draft(draft: dict) -> str:
    """Misma lógica que build_dedup_fingerprint pero desde borrador de ingestión."""
    component = normalize_affected_component((draft.get("componente_afectado") or "").strip())
    cve = (draft.get("cve") or "").strip().upper()
    if cve and component:
        return f"cve:{cve}|asset:{component}"
    if cve:
        return f"cve:{cve}|asset:*"

    plugin = (draft.get("tool_vuln_id") or "").strip()
    if not plugin and draft.get("raw_tool_output"):
        plugin = extract_nessus_plugin_id(str(draft.get("raw_tool_output"))) or ""
    if plugin and component:
        return f"plugin:{plugin}|asset:{component}"
    if plugin:
        return f"plugin:{plugin}|asset:*"

    title = (draft.get("titulo") or "").strip().lower()
    sev = draft.get("severidad")
    sev_str = sev.value if hasattr(sev, "value") else str(sev or "")
    base = f"{title}|{component}|{sev_str}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]
    return f"hash:{digest}"


def build_dedup_fingerprint(finding: Finding) -> str:
    component = _resolve_component(finding)
    cve = (finding.cve or "").strip().upper()
    if cve and component:
        return f"cve:{cve}|asset:{component}"
    if cve:
        return f"cve:{cve}|asset:*"

    _src, vid = resolve_finding_tool_identity(finding)
    plugin = (vid or "").strip() or extract_nessus_plugin_id(finding.raw_tool_output) or ""
    if plugin and component:
        return f"plugin:{plugin}|asset:{component}"
    if plugin:
        return f"plugin:{plugin}|asset:*"

    base = duplicate_key(finding)
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]
    return f"hash:{digest}"
