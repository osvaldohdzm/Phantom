"""Sincroniza hallazgos con core.vulns_catalog (catálogo operativo CFR)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.core import Finding
from app.services.ingest_common import parse_float_maybe
from app.services.catalog_tool_index import (
    ensure_finding_tool_identity,
    lookup_catalog_by_tool_index,
    resolve_finding_tool_identity,
)
from app.services.tenant_locale import (
    DEFAULT_TENANT_LANGUAGE,
    TenantLanguage,
    catalog_column,
    catalog_field_map,
    catalog_remediation_columns,
    catalog_title_columns,
    tenant_language_for_id,
)
from app.services.vulns_catalog_lookup import (
    _map_catalog_severity,
    _txt,
    catalog_text,
    lookup_catalog_by_id,
    resolve_operational_catalog_for_finding,
)


def operational_catalog_finding_overlay(
    finding: Finding,
    cat: dict,
    *,
    language: TenantLanguage = DEFAULT_TENANT_LANGUAGE,
    force: bool = True,
) -> dict[str, object]:
    """Valores de hallazgo según catálogo operativo (sin mutar el ORM)."""
    out: dict[str, object] = {}

    def set_if(attr: str, value: str | None) -> None:
        if not value:
            return
        current = (getattr(finding, attr) or "").strip()
        if force or not current:
            out[attr] = value

    title_col, title_fallback = catalog_title_columns(language)
    titulo = catalog_text(cat, title_col, title_fallback)
    set_if("titulo", titulo[:500] if titulo else None)

    sev = cat.get(catalog_column(language, "severity"))
    if sev:
        mapped = _map_catalog_severity(str(sev))
        if force or finding.severidad != mapped:
            out["severidad"] = mapped

    for attr, key, max_len in catalog_field_map(language):
        raw = cat.get(key)
        if not raw:
            continue
        value = _txt(str(raw))[:max_len]
        set_if(attr, value)

    rem_private, rem_general = catalog_remediation_columns(language)
    rem = cat.get(rem_private) or cat.get(rem_general)
    if rem:
        value = _txt(str(rem))[:32000]
        set_if("propuesta_remediacion", value)

    cve = cat.get("CVE")
    if cve and (force or not (finding.cve or "").strip()):
        out["cve"] = str(cve)[:32]

    cwe = cat.get("CWE")
    if cwe and (force or not (finding.cwe or "").strip()):
        out["cwe"] = str(cwe)[:32]

    cvss = cat.get("CVSSOverallScore3_1")
    if cvss is not None and (force or finding.cvss_score is None):
        parsed = parse_float_maybe(str(cvss))
        if parsed is not None:
            out["cvss_score"] = parsed

    vector = cat.get("CVSSVector3_1")
    if vector and (force or not (finding.cvss_vector or "").strip()):
        out["cvss_vector"] = str(vector)[:128]

    return out


def apply_operational_catalog_to_finding(
    finding: Finding,
    cat: dict,
    *,
    force: bool = True,
    language: TenantLanguage = DEFAULT_TENANT_LANGUAGE,
) -> bool:
    """Copia campos localizados del catálogo operativo al hallazgo."""
    changed = False

    title_col, title_fallback = catalog_title_columns(language)
    titulo = catalog_text(cat, title_col, title_fallback)
    if titulo and (force or not (finding.titulo or "").strip()):
        finding.titulo = titulo[:500]
        changed = True

    sev = cat.get(catalog_column(language, "severity"))
    if sev:
        mapped = _map_catalog_severity(str(sev))
        if force or finding.severidad != mapped:
            finding.severidad = mapped
            changed = True

    for attr, key, max_len in catalog_field_map(language):
        raw = cat.get(key)
        if not raw:
            continue
        value = _txt(str(raw))[:max_len]
        if not value:
            continue
        current = (getattr(finding, attr) or "").strip()
        if force or not current:
            setattr(finding, attr, value)
            changed = True

    rem_private, rem_general = catalog_remediation_columns(language)
    rem = cat.get(rem_private) or cat.get(rem_general)
    if rem:
        value = _txt(str(rem))[:32000]
        if value and (force or not (finding.propuesta_remediacion or "").strip()):
            finding.propuesta_remediacion = value
            changed = True

    cve = cat.get("CVE")
    if cve and (force or not (finding.cve or "").strip()):
        finding.cve = str(cve)[:32]
        changed = True

    cwe = cat.get("CWE")
    if cwe and (force or not (finding.cwe or "").strip()):
        finding.cwe = str(cwe)[:32]
        changed = True

    cvss = cat.get("CVSSOverallScore3_1")
    if cvss is not None and (force or finding.cvss_score is None):
        parsed = parse_float_maybe(str(cvss))
        if parsed is not None:
            finding.cvss_score = parsed
            changed = True

    vector = cat.get("CVSSVector3_1")
    if vector and (force or not (finding.cvss_vector or "").strip()):
        finding.cvss_vector = str(vector)[:128]
        changed = True

    return changed


def sync_finding_from_operational_catalog(
    db: Session,
    finding: Finding,
    *,
    force: bool = True,
    group_members: Optional[list[Finding]] = None,
    language: Optional[TenantLanguage] = None,
) -> bool:
    lang = language or tenant_language_for_id(db, finding.tenant_id)
    cat = resolve_operational_catalog_for_finding(db, finding, group_members=group_members)
    if not cat:
        return False
    return apply_operational_catalog_to_finding(finding, cat, force=force, language=lang)


def findings_matching_catalog_entry(
    db: Session,
    catalog_id: str,
    *,
    engagement_id=None,
) -> tuple[Optional[dict], list[Finding]]:
    """Hallazgos del proyecto (o global) que corresponden a una fila del catálogo operativo."""
    cat = lookup_catalog_by_id(db, catalog_id)
    if not cat:
        return None, []

    query = db.query(Finding)
    if engagement_id is not None:
        query = query.filter(Finding.engagement_id == engagement_id)
    candidates = query.order_by(Finding.created_at.asc()).all()

    catalog_row_id = str(cat.get("Id"))
    matched: list[Finding] = []
    seen: set = set()

    for finding in candidates:
        ensure_finding_tool_identity(finding)
        if finding.id in seen:
            continue
        src, vid = resolve_finding_tool_identity(finding)
        if not vid:
            continue
        resolved = lookup_catalog_by_tool_index(db, src, vid)
        if resolved and str(resolved.get("Id")) == catalog_row_id:
            seen.add(finding.id)
            matched.append(finding)

    return cat, matched


def sync_findings_from_operational_catalog(
    db: Session,
    findings: list[Finding],
    *,
    force: bool = True,
    persist: bool = True,
    language: Optional[TenantLanguage] = None,
) -> tuple[int, int, list[str]]:
    """Sincroniza hallazgos desde catálogo operativo. Devuelve (synced, skipped, errors)."""
    synced = 0
    skipped = 0
    errors: list[str] = []

    for finding in findings:
        try:
            ensure_finding_tool_identity(finding)
            lang = language or tenant_language_for_id(db, finding.tenant_id)
            if sync_finding_from_operational_catalog(
                db, finding, force=force, language=lang
            ):
                synced += 1
            else:
                skipped += 1
        except Exception as exc:
            label = (finding.titulo or str(finding.id))[:48]
            errors.append(f"{label}: {exc}")

    if persist and synced > 0:
        db.commit()
        for f in findings:
            db.refresh(f)

    return synced, skipped, errors
