"""Llave compuesta para deduplicación: activo + CVE / Plugin ID / título."""

from __future__ import annotations

import hashlib

from app.models.core import Finding
from app.services.catalog_tool_index import resolve_finding_tool_identity
from app.services.finding_duplicates import duplicate_key, normalize_affected_component
from app.services.import_asset_scope import asset_scope_suffix_from_ctx
from app.services.text_encoding import extract_nessus_plugin_id


def _scope_suffix_from_draft(draft: dict) -> str:
    ctx = draft.get("import_context")
    return asset_scope_suffix_from_ctx(ctx if isinstance(ctx, dict) else None)


def _scope_suffix_from_finding(finding: Finding) -> str:
    sources = finding.detection_sources or []
    for entry in sources:
        if isinstance(entry, dict):
            suffix = asset_scope_suffix_from_ctx(entry)
            if suffix:
                return suffix
    return ""


def _resolve_component(finding: Finding) -> str:
    direct = (finding.componente_afectado or "").strip()
    if direct:
        return normalize_affected_component(direct)
    from app.services.finding_duplicates import _resolve_componente

    return normalize_affected_component(_resolve_componente(finding))


def build_dedup_fingerprint_from_draft(draft: dict) -> str:
    """Misma lógica que build_dedup_fingerprint pero desde borrador de ingestión."""
    scope = _scope_suffix_from_draft(draft)
    component = normalize_affected_component((draft.get("componente_afectado") or "").strip())
    cve = (draft.get("cve") or "").strip().upper()
    if cve and component:
        return f"cve:{cve}|asset:{component}{scope}"
    if cve:
        return f"cve:{cve}|asset:*{scope}"

    plugin = (draft.get("tool_vuln_id") or "").strip()
    if not plugin and draft.get("raw_tool_output"):
        plugin = extract_nessus_plugin_id(str(draft.get("raw_tool_output"))) or ""
    if plugin and component:
        return f"plugin:{plugin}|asset:{component}{scope}"
    if plugin:
        return f"plugin:{plugin}|asset:*{scope}"

    title = (draft.get("titulo") or "").strip().lower()
    sev = draft.get("severidad")
    sev_str = sev.value if hasattr(sev, "value") else str(sev or "")
    base = f"{title}|{component}|{sev_str}{scope}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]
    return f"hash:{digest}"


def build_dedup_fingerprint(finding: Finding) -> str:
    scope = _scope_suffix_from_finding(finding)
    component = _resolve_component(finding)
    cve = (finding.cve or "").strip().upper()
    if cve and component:
        return f"cve:{cve}|asset:{component}{scope}"
    if cve:
        return f"cve:{cve}|asset:*{scope}"

    _src, vid = resolve_finding_tool_identity(finding)
    plugin = (vid or "").strip() or extract_nessus_plugin_id(finding.raw_tool_output) or ""
    if plugin and component:
        return f"plugin:{plugin}|asset:{component}{scope}"
    if plugin:
        return f"plugin:{plugin}|asset:*{scope}"

    base = duplicate_key(finding) + scope
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]
    return f"hash:{digest}"
