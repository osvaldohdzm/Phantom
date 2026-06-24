"""Lookup operativo en core.vulns_catalog (catálogo CFR / Excel)."""

from __future__ import annotations

import re
from typing import Any, Optional, TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from app.services.catalog_tool_index import CatalogIngestCache

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.core import Finding, Severity
from app.services.catalog_tool_index import (
    CatalogIngestCache,
    lookup_catalog_by_tool_index,
    normalize_tool_source,
    resolve_finding_tool_identity,
)
from app.services.tenant_locale import (
    DEFAULT_TENANT_LANGUAGE,
    TenantLanguage,
    catalog_column,
    catalog_remediation_columns,
    catalog_title_columns,
    tenant_language_for_id,
)
from app.services.ingest_common import map_scanner_severity, parse_float_maybe
from app.services.text_encoding import extract_nessus_plugin_id, fix_text_encoding
from app.services.vulns_catalog_schema import (
    rollback_db_on_error,
    vulns_catalog_lookup_select_clause,
    vulns_catalog_table_columns,
)

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
    if not vulns_catalog_table_columns(db):
        return None
    try:
        row = db.execute(
            text(
                f"""
                SELECT {vulns_catalog_lookup_select_clause(db)}
                FROM core.vulns_catalog
                WHERE TRIM("Id"::text) = :cid
                LIMIT 1
                """
            ),
            {"cid": cid},
        ).mappings().first()
        return _row_to_dict(row)
    except Exception:
        rollback_db_on_error(db)
        return None


def lookup_catalog_by_token(db: Session, token: str) -> Optional[dict[str, Any]]:
    t = (token or "").strip()
    if len(t) < 4:
        return None
    like = f"%{t}%"
    cols = vulns_catalog_table_columns(db)
    if not cols:
        return None
    token_filters = [
        '"StandardVulnerabilityName" ILIKE :like',
        '"EspNombreVulnerabilidadUnificado" ILIKE :like',
    ]
    if "CVE" in cols:
        token_filters.insert(0, '"CVE" ILIKE :like')
    if "Vulnerability" in cols:
        token_filters.append('"Vulnerability" ILIKE :like')
    if "Description" in cols:
        token_filters.append('"Description" ILIKE :like')
    if not token_filters:
        return None
    where_sql = " OR ".join(token_filters)
    order_cases: list[str] = []
    if "CVE" in cols:
        order_cases.append('WHEN "CVE" ILIKE :exact THEN 0')
    if "StandardVulnerabilityName" in cols:
        order_cases.append(
            f'WHEN "StandardVulnerabilityName" ILIKE :exact THEN {len(order_cases)}'
        )
    if "EspNombreVulnerabilidadUnificado" in cols:
        order_cases.append(
            f'WHEN "EspNombreVulnerabilidadUnificado" ILIKE :exact THEN {len(order_cases)}'
        )
    order_sql = (
        "CASE\n                    "
        + "\n                    ".join(order_cases)
        + f"\n                    ELSE {len(order_cases)}\n                  END"
        if order_cases
        else f"{len(order_cases)}"
    )
    try:
        row = db.execute(
            text(
                f"""
                SELECT {vulns_catalog_lookup_select_clause(db)}
                FROM core.vulns_catalog
                WHERE {where_sql}
                ORDER BY
                  {order_sql},
                  "Id"::int DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"like": like, "exact": t},
        ).mappings().first()
        return _row_to_dict(row)
    except Exception:
        rollback_db_on_error(db)
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


def _usable_locale_field(
    cat: dict[str, Any],
    column: str,
    *,
    language: TenantLanguage = DEFAULT_TENANT_LANGUAGE,
) -> Optional[str]:
    """Campo localizado del catálogo si cumple longitud mínima y no es copia redundante."""
    min_lens = {
        catalog_column("es", "description"): 30,
        catalog_column("es", "threat_general"): 30,
        catalog_column("es", "threat_internet"): 20,
        catalog_column("es", "remediation"): 15,
        catalog_column("es", "remediation_private"): 15,
        catalog_column("es", "technical_explanation"): 10,
        catalog_column("es", "detection_method"): 5,
        catalog_column("en", "description"): 30,
        catalog_column("en", "threat_general"): 30,
        catalog_column("en", "remediation"): 15,
        catalog_column("en", "detection_method"): 5,
    }
    min_len = min_lens.get(column, 1)
    raw = _txt(cat.get(column))
    if not raw or len(raw) < min_len:
        return None
    if language == "es":
        desc_en = _txt(cat.get("Description"))
        if column == catalog_column("es", "description") and desc_en and raw.casefold() == desc_en.casefold():
            return None
        sol_en = _txt(cat.get("Solution"))
        if column.startswith("EspPropuesta") and sol_en and raw.casefold() == sol_en.casefold():
            return None
        danger_en = _txt(cat.get("Danger"))
        if column.startswith("EspAmenaza") and danger_en and raw.casefold() == danger_en.casefold():
            return None
    return raw[:32000]


def _usable_esp_field(cat: dict[str, Any], esp_key: str) -> Optional[str]:
    return _usable_locale_field(cat, esp_key, language="es")


_CATALOG_PROPAGATE_KEYS = (
    "titulo",
    "severidad",
    "descripcion",
    "amenaza_ampliada",
    "propuesta_remediacion",
    "metodo_deteccion",
    "explicacion_tecnica",
    "referencias",
    "catalog_vulns_id",
    "cve",
    "cwe",
    "cvss_score",
    "cvss_vector",
)


def propagate_catalog_fields(template: dict[str, Any], draft: dict[str, Any]) -> None:
    """Copia campos de catálogo de un draft representante al resto del mismo plugin."""
    cid = draft.get("catalog_vulns_id") or template.get("catalog_vulns_id")
    if cid:
        draft["catalog_vulns_id"] = cid
    for key in _CATALOG_PROPAGATE_KEYS:
        if key == "catalog_vulns_id":
            continue
        if not draft.get(key) and template.get(key) is not None:
            draft[key] = template[key]


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


def _apply_catalog_to_draft(
    draft: dict[str, Any],
    cat: dict[str, Any],
    *,
    language: TenantLanguage = DEFAULT_TENANT_LANGUAGE,
) -> None:
    title_col, title_fallback = catalog_title_columns(language)
    titulo = catalog_text(cat, title_col, title_fallback)
    if titulo:
        draft["titulo"] = titulo[:500]

    sev = cat.get(catalog_column(language, "severity"))
    if sev:
        draft["severidad"] = _map_catalog_severity(str(sev))

    desc = _usable_locale_field(cat, catalog_column(language, "description"), language=language)
    if desc:
        draft["descripcion"] = desc

    threat = _usable_locale_field(cat, catalog_column(language, "threat_general"), language=language)
    if not threat and language == "es":
        threat = _usable_locale_field(
            cat, catalog_column(language, "threat_internet"), language=language
        )
    if threat:
        draft["amenaza_ampliada"] = threat

    rem_private, rem_general = catalog_remediation_columns(language)
    rem = _usable_locale_field(cat, rem_private, language=language) or _usable_locale_field(
        cat, rem_general, language=language
    )
    if rem:
        draft["propuesta_remediacion"] = rem

    metodo = _usable_locale_field(
        cat, catalog_column(language, "detection_method"), language=language
    )
    if metodo:
        draft["metodo_deteccion"] = metodo

    tecnica = _usable_locale_field(
        cat, catalog_column(language, "technical_explanation"), language=language
    )
    if tecnica and tecnica != desc:
        draft["explicacion_tecnica"] = tecnica

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
    language: Optional[TenantLanguage] = None,
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

    lang = language
    if lang is None:
        tenant_raw = draft.get("tenant_id")
        if tenant_raw:
            try:
                lang = tenant_language_for_id(db, UUID(str(tenant_raw)))
            except (TypeError, ValueError):
                lang = DEFAULT_TENANT_LANGUAGE
        else:
            lang = DEFAULT_TENANT_LANGUAGE

    _apply_catalog_to_draft(draft, cat, language=lang)
    return True


def enrich_drafts_with_catalog(
    db: Session,
    drafts: list[dict[str, Any]],
    *,
    tenant_id: Optional[UUID] = None,
) -> int:
    """Enriquece drafts por Plugin ID único y propaga a filas duplicadas."""
    if not drafts:
        return 0
    lang = tenant_language_for_id(db, tenant_id) if tenant_id else DEFAULT_TENANT_LANGUAGE
    if tenant_id:
        tid = str(tenant_id)
        for draft in drafts:
            draft.setdefault("tenant_id", tid)
    cache = CatalogIngestCache(db)
    by_source: dict[str, set[str]] = {}
    for draft in drafts:
        source = str(draft.get("tool_source") or "Nessus").strip()
        original_id = str(
            draft.get("tool_vuln_id") or draft.get("nessus_plugin_id") or ""
        ).strip()
        if original_id:
            by_source.setdefault(source, set()).add(original_id)
    for source, ids in by_source.items():
        cache.preload_catalog_batch(source, sorted(ids))

    representatives: dict[tuple[str, str], dict[str, Any]] = {}
    for draft in drafts:
        source = str(draft.get("tool_source") or "Nessus").strip()
        original_id = str(
            draft.get("tool_vuln_id") or draft.get("nessus_plugin_id") or ""
        ).strip()
        if not original_id:
            continue
        key = (source, original_id)
        if key not in representatives:
            representatives[key] = draft

    hits = 0
    templates: dict[tuple[str, str], dict[str, Any]] = {}
    for key, rep in representatives.items():
        if enrich_draft_with_catalog(db, rep, cache=cache, language=lang):
            hits += 1
        templates[key] = rep

    for draft in drafts:
        source = str(draft.get("tool_source") or "Nessus").strip()
        original_id = str(
            draft.get("tool_vuln_id") or draft.get("nessus_plugin_id") or ""
        ).strip()
        if not original_id:
            continue
        template = templates.get((source, original_id))
        if template and template is not draft:
            propagate_catalog_fields(template, draft)
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
