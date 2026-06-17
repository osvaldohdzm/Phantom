"""Lookup operativo en core.vulns_catalog (catálogo CFR / Excel)."""

from __future__ import annotations

import re
from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.catalog_tool_index import CatalogIngestCache

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.core import Finding, Severity
from app.services.catalog_tool_index import (
    CatalogIngestCache,
    lookup_catalog_by_tool_index,
    resolve_finding_tool_identity,
)
from app.services.ingest_common import map_scanner_severity, parse_float_maybe
from app.services.text_encoding import extract_nessus_plugin_id, fix_text_encoding

_CATALOG_SELECT = """
                  "Id",
                  "EspNombreVulnerabilidadUnificado",
                  "EspSeveridadUnificada",
                  "EspDescripcionUnificada",
                  "EspAmenazaUnificadaGeneral",
                  "EspAmenazaUnificadaDesdeInternet",
                  "EspPropuestaRemediacionUnificadaEnRedPrivada",
                  "EspPropuestaRemediacionUnificada",
                  "EspMetodoDeteccion",
                  "EspExplicacionTecnica",
                  "References",
                  "CVE",
                  "CWE",
                  "CVSSOverallScore3_1",
                  "CVSSVector3_1",
                  "StandardVulnerabilityName",
                  "NessusPluginId"
"""

_CVE_RE = re.compile(r"CVE-\d{4}-\d+", re.IGNORECASE)
_ADVISORY_RE = re.compile(r"\(([a-z]{2,}-[a-z0-9][-a-z0-9]*)\)", re.IGNORECASE)
_PLUGIN_IN_TEXT_RE = re.compile(r"plugin(?:\s+ID)?[:\s]+(\d+)", re.IGNORECASE)


def _map_catalog_severity(raw: Optional[str]) -> Severity:
    if not raw:
        return Severity.medium
    t = raw.strip().upper()
    if "CRIT" in t or "CRÍT" in t:
        return Severity.critical
    if t in ("ALTA", "HIGH", "ALTO") or "HIGH" in t:
        return Severity.high
    if t in ("MEDIA", "MEDIUM", "MEDIO", "MODERATE") or "MED" in t:
        return Severity.medium
    if t in ("BAJA", "LOW", "BAJO"):
        return Severity.low
    if "INFO" in t or "INFORMATIV" in t:
        return Severity.info
    return map_scanner_severity(raw)


def _row_to_dict(row) -> Optional[dict[str, Any]]:
    return dict(row) if row else None


def lookup_nessus_plugin(db: Session, plugin_id: str) -> Optional[dict[str, Any]]:
    return lookup_catalog_by_tool_index(db, "Nessus", plugin_id)


def lookup_catalog_by_id(db: Session, catalog_id: str) -> Optional[dict[str, Any]]:
    cid = (catalog_id or "").strip()
    if not cid:
        return None
    try:
        row = db.execute(
            text(
                f"""
                SELECT {_CATALOG_SELECT}
                FROM core.vulns_catalog
                WHERE TRIM("Id"::text) = :cid
                LIMIT 1
                """
            ),
            {"cid": cid},
        ).mappings().first()
        return _row_to_dict(row)
    except Exception:
        return None


def lookup_catalog_by_token(db: Session, token: str) -> Optional[dict[str, Any]]:
    t = (token or "").strip()
    if len(t) < 4:
        return None
    like = f"%{t}%"
    try:
        row = db.execute(
            text(
                f"""
                SELECT {_CATALOG_SELECT}
                FROM core.vulns_catalog
                WHERE "CVE" ILIKE :like
                   OR "StandardVulnerabilityName" ILIKE :like
                   OR "EspNombreVulnerabilidadUnificado" ILIKE :like
                   OR "Vulnerability" ILIKE :like
                   OR "Description" ILIKE :like
                ORDER BY
                  CASE
                    WHEN "CVE" ILIKE :exact THEN 0
                    WHEN "StandardVulnerabilityName" ILIKE :exact THEN 1
                    WHEN "EspNombreVulnerabilidadUnificado" ILIKE :exact THEN 2
                    ELSE 3
                  END,
                  "Id"::int DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"like": like, "exact": t},
        ).mappings().first()
        return _row_to_dict(row)
    except Exception:
        return None


def _extract_lookup_tokens(
    titulo: str,
    cve: Optional[str],
    raw_tool_output: Optional[str],
) -> list[str]:
    tokens: list[str] = []
    seen: set[str] = set()

    def add(value: Optional[str]) -> None:
        t = (value or "").strip()
        if len(t) < 4:
            return
        key = t.casefold()
        if key in seen:
            return
        seen.add(key)
        tokens.append(t)

    if cve and cve.strip():
        add(cve.strip())

    haystack = f"{titulo or ''}\n{raw_tool_output or ''}"
    for match in _CVE_RE.finditer(haystack):
        add(match.group(0).upper())
    for match in _ADVISORY_RE.finditer(haystack):
        add(match.group(1))

    title = (titulo or "").strip()
    if len(title) >= 12:
        add(title)

    return tokens


def _plugin_ids_in_text(*chunks: Optional[str]) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        if not chunk:
            continue
        for match in _PLUGIN_IN_TEXT_RE.finditer(chunk):
            pid = match.group(1)
            if pid not in seen:
                seen.add(pid)
                found.append(pid)
    return found


def resolve_operational_catalog_for_finding(
    db: Session,
    finding: Finding,
    *,
    group_members: Optional[list[Finding]] = None,
) -> Optional[dict[str, Any]]:
    """Localiza fila en core.vulns_catalog (plugin, tokens CVE/advisory/título)."""
    if finding.catalog_id is not None:
        cat = lookup_catalog_by_id(db, str(finding.catalog_id))
        if cat:
            return cat

    candidates: list[Finding] = [finding]
    if group_members:
        candidates.extend(m for m in group_members if m.id != finding.id)

    for item in candidates:
        src, vid = resolve_finding_tool_identity(item)
        if vid:
            cat = lookup_catalog_by_tool_index(db, src, vid)
            if cat:
                return cat

        pid = extract_nessus_plugin_id(item.raw_tool_output)
        if pid:
            cat = lookup_nessus_plugin(db, pid)
            if cat:
                return cat

        for pid_text in _plugin_ids_in_text(
            item.titulo, item.descripcion, item.metodo_deteccion, item.raw_tool_output
        ):
            cat = lookup_nessus_plugin(db, pid_text)
            if cat:
                return cat

        for token in _extract_lookup_tokens(item.titulo, item.cve, item.raw_tool_output):
            cat = lookup_catalog_by_token(db, token)
            if cat:
                return cat

    return None


def catalog_text(cat: Optional[dict[str, Any]], *keys: str) -> str:
    if not cat:
        return ""
    for key in keys:
        raw = cat.get(key)
        if raw is None:
            continue
        value = _txt(raw)
        if value:
            return value
    return ""


def _txt(value: object) -> str:
    return (fix_text_encoding(str(value)) or str(value)).strip()


def build_componente_afectado(host: str, port: str, proto: str) -> str:
    host = (host or "").strip()
    port = (port or "").strip()
    proto = (proto or "").strip()
    if not host:
        return ""
    if port and port not in ("0", "none"):
        suffix = f":{port}"
        if proto and proto.lower() not in ("tcp", "udp", ""):
            return f"{host}{suffix}/{proto}"
        return f"{host}{suffix}"
    return host


def _apply_catalog_to_draft(draft: dict[str, Any], cat: dict[str, Any]) -> None:

    titulo = catalog_text(cat, "EspNombreVulnerabilidadUnificado", "StandardVulnerabilityName")
    if titulo:
        draft["titulo"] = titulo[:500]

    sev = cat.get("EspSeveridadUnificada")
    if sev:
        draft["severidad"] = _map_catalog_severity(str(sev))

    if cat.get("EspDescripcionUnificada"):
        draft["descripcion"] = _txt(cat["EspDescripcionUnificada"])[:32000]

    if cat.get("EspAmenazaUnificadaGeneral"):
        draft["amenaza_ampliada"] = _txt(cat["EspAmenazaUnificadaGeneral"])[:32000]

    rem = cat.get("EspPropuestaRemediacionUnificadaEnRedPrivada") or cat.get(
        "EspPropuestaRemediacionUnificada"
    )
    if rem:
        draft["propuesta_remediacion"] = _txt(rem)[:32000]

    if cat.get("EspMetodoDeteccion"):
        draft["metodo_deteccion"] = _txt(cat["EspMetodoDeteccion"])[:32000]

    if cat.get("EspExplicacionTecnica"):
        draft["explicacion_tecnica"] = _txt(cat["EspExplicacionTecnica"])[:32000]

    if cat.get("References"):
        draft["referencias"] = _txt(cat["References"])[:32000]

    if cat.get("CVE") and not draft.get("cve"):
        draft["cve"] = str(cat["CVE"])[:32]
    if cat.get("CWE") and not draft.get("cwe"):
        draft["cwe"] = str(cat["CWE"])[:32]

    cvss = cat.get("CVSSOverallScore3_1")
    if cvss is not None and draft.get("cvss_score") is None:
        draft["cvss_score"] = parse_float_maybe(str(cvss))
    if cat.get("CVSSVector3_1") and not draft.get("cvss_vector"):
        draft["cvss_vector"] = str(cat["CVSSVector3_1"])[:128]

    comp = build_componente_afectado(
        draft.get("host") or "",
        draft.get("port") or "",
        draft.get("proto") or "",
    )
    if comp:
        draft["componente_afectado"] = comp

    draft["catalog_vulns_id"] = cat.get("Id")


def enrich_draft_with_catalog(
    db: Session,
    draft: dict[str, Any],
    *,
    cache: Optional["CatalogIngestCache"] = None,
) -> bool:
    """Rellena campos del hallazgo desde catálogo por índice herramienta (tipo origen + id)."""
    source = str(draft.get("tool_source") or "Nessus").strip()
    original_id = str(
        draft.get("tool_vuln_id") or draft.get("nessus_plugin_id") or ""
    ).strip()
    if not original_id:
        return False

    cat = (
        cache.lookup(source, original_id)
        if cache is not None
        else lookup_catalog_by_tool_index(db, source, original_id)
    )
    if not cat:
        return False

    _apply_catalog_to_draft(draft, cat)
    return True


def enrich_drafts_with_catalog(
    db: Session,
    drafts: list[dict[str, Any]],
) -> int:
    """Enriquece un lote de drafts con una sola cache de catálogo."""
    cache = CatalogIngestCache(db)
    hits = 0
    for draft in drafts:
        if enrich_draft_with_catalog(db, draft, cache=cache):
            hits += 1
    return hits


def enrich_nessus_draft_with_catalog(
    db: Session,
    draft: dict[str, Any],
    *,
    cache: Optional["CatalogIngestCache"] = None,
) -> bool:
    """Rellena campos del hallazgo desde catálogo por Plugin ID Nessus."""
    if not draft.get("tool_source"):
        draft["tool_source"] = "Nessus"
    if not draft.get("tool_vuln_id") and draft.get("nessus_plugin_id"):
        draft["tool_vuln_id"] = str(draft["nessus_plugin_id"]).strip()
    return enrich_draft_with_catalog(db, draft, cache=cache)
