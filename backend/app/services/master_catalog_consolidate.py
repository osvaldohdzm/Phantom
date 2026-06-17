"""Consolidación Servicios → Catálogo maestro operativo (vulns_catalog) + metadatos globales."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.core import Engagement, Finding


from app.services.catalog_from_draft import CatalogEnsureCache, ensure_draft_catalog
from app.services.catalog_tool_index import ensure_finding_tool_identity
from app.services.dedup_fingerprint import build_dedup_fingerprint
from app.services.finding_history import append_finding_history
from app.services.ingest_common import load_vulnerabilities_catalog_ids, resolve_finding_catalog_fk
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _txt(value: object | None, max_len: int = 32000) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return s[:max_len] if s else ""


def finding_to_draft(finding: Finding) -> dict[str, Any]:
    ensure_finding_tool_identity(finding)
    return {
        "titulo": finding.titulo,
        "descripcion": finding.descripcion,
        "severidad": finding.severidad,
        "cve": finding.cve,
        "cwe": finding.cwe,
        "cvss_score": finding.cvss_score,
        "cvss_vector": finding.cvss_vector,
        "componente_afectado": finding.componente_afectado,
        "metodo_deteccion": finding.metodo_deteccion,
        "tool_source": finding.tool_source or "manual",
        "tool_vuln_id": finding.tool_vuln_id,
        "propuesta_remediacion": finding.propuesta_remediacion,
        "amenaza_ampliada": finding.amenaza_ampliada,
        "explicacion_tecnica": finding.explicacion_tecnica,
        "raw_tool_output": finding.raw_tool_output,
        "referencias": finding.referencias,
        "catalog_vulns_id": None,
    }


def _build_ai_summary(finding: Finding) -> str:
    for field in (finding.descripcion, finding.amenaza_ampliada, finding.explicacion_tecnica):
        text = _txt(field, 600)
        if len(text) >= 40:
            return text
    return _txt(finding.titulo, 200)


def _engagement_label(db: Session, engagement_id: Optional[UUID]) -> str:
    if not engagement_id:
        return "Sin proyecto"
    eg = db.get(Engagement, engagement_id)
    if not eg:
        return str(engagement_id)
    return (eg.nombre_proyecto or eg.cliente or str(engagement_id))[:255]


def _append_origin_project(
    finding: Finding,
    db: Session,
    now: datetime,
) -> None:
    projects: list[dict[str, Any]] = list(finding.origin_projects or [])
    eid = str(finding.engagement_id) if finding.engagement_id else None
    label = _engagement_label(db, finding.engagement_id)
    existing = next((p for p in projects if p.get("engagement_id") == eid), None)
    if existing:
        existing["last_seen"] = now.isoformat()
        existing["name"] = label
    else:
        projects.append(
            {
                "engagement_id": eid,
                "name": label,
                "first_seen": (finding.first_seen or now).isoformat(),
                "last_seen": now.isoformat(),
            }
        )
    finding.origin_projects = projects


def _append_detection_source(finding: Finding, now: datetime) -> None:
    sources: list[dict[str, Any]] = list(finding.detection_sources or [])
    src = (finding.tool_source or "manual").strip()
    entry = {
        "source": src,
        "tool": src,
        "at": now.isoformat(),
        "method": _txt(finding.metodo_deteccion, 120) or None,
    }
    if not any(s.get("source") == src and s.get("at") == entry["at"] for s in sources):
        sources.append(entry)
    finding.detection_sources = sources[-20:]


def _assign_group_id(db: Session, finding: Finding, fingerprint: str) -> UUID:
    if finding.ai_group_id:
        return finding.ai_group_id
    peer = (
        db.query(Finding)
        .filter(Finding.dedup_fingerprint == fingerprint, Finding.ai_group_id.isnot(None))
        .order_by(Finding.created_at.asc())
        .first()
    )
    group_id = peer.ai_group_id if peer and peer.ai_group_id else uuid4()
    finding.ai_group_id = group_id
    return group_id


def consolidate_finding(
    db: Session,
    finding: Finding,
    cache: CatalogEnsureCache,
    valid_catalog_ids: set[int],
    *,
    now: Optional[datetime] = None,
) -> str:
    """Consolida un hallazgo. Retorna linked|created|merged|skipped|error."""
    ts = now or _now()
    try:
        fingerprint = build_dedup_fingerprint(finding)
        finding.dedup_fingerprint = fingerprint
        _assign_group_id(db, finding, fingerprint)

        draft = finding_to_draft(finding)
        result = ensure_draft_catalog(db, draft, cache, create_if_missing=True)
        op_id = draft.get("catalog_vulns_id")
        if op_id:
            meta = list(finding.detection_sources or [])
            if not any(m.get("vulns_catalog_id") == str(op_id) for m in meta):
                meta.append({"vulns_catalog_id": str(op_id), "at": ts.isoformat()})
                finding.detection_sources = meta[-20:]

        fk = resolve_finding_catalog_fk(op_id, valid_catalog_ids)
        if fk:
            finding.catalog_id = fk

        _append_origin_project(finding, db, ts)
        _append_detection_source(finding, ts)
        finding.first_seen = finding.first_seen or ts
        finding.last_seen = ts
        finding.sync_status = "synced"
        finding.global_status = "SINCRONIZADO"
        finding.ai_summary = _build_ai_summary(finding)
        finding.remediation_context = _txt(finding.propuesta_remediacion) or None
        append_finding_history(
            db,
            finding,
            "consolidate",
            {"result": result, "catalog_id": finding.catalog_id, "fingerprint": fingerprint},
        )
        return result
    except Exception as exc:
        finding.sync_status = "error"
        append_finding_history(db, finding, "consolidate_error", {"error": str(exc)[:500]})
        raise


def consolidate_findings_batch(
    db: Session,
    findings: list[Finding],
) -> dict[str, Any]:
    if not findings:
        return {"synced": 0, "skipped": 0, "errors": [], "groups": 0}

    cache = CatalogEnsureCache(db)
    valid_catalog_ids = load_vulnerabilities_catalog_ids(db)
    now = _now()
    stats = {"linked": 0, "created": 0, "merged": 0, "skipped": 0, "error": 0}
    errors: list[str] = []
    groups: set[str] = set()

    for finding in findings:
        try:
            r = consolidate_finding(db, finding, cache, valid_catalog_ids, now=now)
            stats[r] = stats.get(r, 0) + 1
            if finding.dedup_fingerprint:
                groups.add(finding.dedup_fingerprint)
        except Exception as exc:
            stats["error"] += 1
            label = (finding.titulo or str(finding.id))[:48]
            errors.append(f"{label}: {exc}")

    db.commit()
    for f in findings:
        db.refresh(f)

    synced = stats["linked"] + stats["created"] + stats["merged"]
    return {
        "synced": synced,
        "skipped": stats["skipped"],
        "errors": errors,
        "groups": len(groups),
        "details": stats,
    }
