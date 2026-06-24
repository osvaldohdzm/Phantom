"""Comparación de escaneos Nessus (AV/infra): actualiza estados sin duplicar reincidencias."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.deps.auth import tenant_findings_filter
from app.models.core import Finding, FindingStatus, Severity
from app.models.scan import ScanRun
from app.services.dedup_fingerprint import build_dedup_fingerprint, build_dedup_fingerprint_from_draft
from app.services.finding_history import append_finding_history
from app.services.finding_import_enrich import enrich_finding_import_context
from app.services.finding_repository_scope import SERVICE_DRAFT_STATUS
from app.services.ingest_common import load_vulnerabilities_catalog_ids, resolve_finding_catalog_fk

# Hallazgos que participan en la comparación de ausencia (activos en el repositorio).
BASELINE_ACTIVE_STATUSES = (
    FindingStatus.abierta,
    FindingStatus.identificado,
    FindingStatus.validada,
    FindingStatus.en_proceso,
    FindingStatus.retest_pendiente,
    FindingStatus.retest_en_curso,
    FindingStatus.reaparecido,
)

# Si reaparecen tras haber sido marcados ausentes/cerrados → reaparecido (no fila nueva).
REOPEN_STATUSES = (
    FindingStatus.atendido,
    FindingStatus.remediado,
    FindingStatus.cerrado,
)


def _severity_from_draft(draft: dict[str, Any]) -> Severity:
    sev = draft.get("severidad")
    if isinstance(sev, Severity):
        return sev
    if hasattr(sev, "value"):
        name = str(sev.name if hasattr(sev, "name") else sev).lower()
        try:
            return Severity[name]
        except KeyError:
            pass
    return Severity.medium


def apply_nessus_rescan(
    db: Session,
    *,
    drafts: list[dict[str, Any]],
    tenant_id: UUID,
    engagement_id: UUID,
    scope: str,
    absent_policy: str,
    scan_run: ScanRun,
    actor: Optional[str] = None,
    fast_rescan: bool = False,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    absent_status = (
        FindingStatus.atendido if absent_policy == "atendido" else FindingStatus.remediado
    )

    query = tenant_findings_filter(db.query(Finding), tenant_id)
    if scope == "engagement":
        query = query.filter(Finding.engagement_id == engagement_id)

    baseline_statuses = BASELINE_ACTIVE_STATUSES + REOPEN_STATUSES
    existing: list[Finding] = query.filter(Finding.status.in_(baseline_statuses)).all()

    by_fp: dict[str, Finding] = {}
    for finding in existing:
        fp = (finding.dedup_fingerprint or "").strip() or build_dedup_fingerprint(finding)
        if not finding.dedup_fingerprint:
            finding.dedup_fingerprint = fp
        if fp not in by_fp:
            by_fp[fp] = finding

    seen_fps: set[str] = set()
    stats = {
        "new_count": 0,
        "updated_count": 0,
        "reaparecido_count": 0,
        "absent_count": 0,
        "total_in_scan": len(drafts),
    }

    valid_catalog_ids = load_vulnerabilities_catalog_ids(db)
    pending_new = 0

    for draft in drafts:
        fp = build_dedup_fingerprint_from_draft(draft)
        seen_fps.add(fp)
        finding = by_fp.get(fp)

        if finding:
            finding.last_seen = draft.get("last_seen") if isinstance(draft.get("last_seen"), datetime) else now
            finding.updated_at = now
            if finding.status in REOPEN_STATUSES:
                prev = finding.status.value
                finding.status = FindingStatus.reaparecido
                append_finding_history(
                    db,
                    finding,
                    "rescan_reaparecido",
                    {
                        "scan_run_id": str(scan_run.id),
                        "from_status": prev,
                        "fingerprint": fp,
                    },
                    actor=actor,
                )
                stats["reaparecido_count"] += 1
            else:
                if not fast_rescan:
                    append_finding_history(
                        db,
                        finding,
                        "rescan_seen",
                        {"scan_run_id": str(scan_run.id), "fingerprint": fp},
                        actor=actor,
                    )
                stats["updated_count"] += 1
            continue

        import_ctx = draft.get("import_context")
        detection_sources: list[dict] = []
        if isinstance(import_ctx, dict) and import_ctx:
            detection_sources.append(
                {
                    **import_ctx,
                    "source": draft.get("tool_source") or "Nessus",
                    "at": now.isoformat(),
                }
            )

        new_finding = Finding(
            titulo=draft["titulo"],
            descripcion=draft.get("descripcion"),
            severidad=_severity_from_draft(draft),
            cvss_score=draft.get("cvss_score"),
            cvss_vector=draft.get("cvss_vector"),
            cve=draft.get("cve"),
            cwe=draft.get("cwe"),
            raw_tool_output=draft.get("raw_tool_output"),
            explicacion_tecnica=draft.get("explicacion_tecnica"),
            amenaza_ampliada=draft.get("amenaza_ampliada"),
            componente_afectado=draft.get("componente_afectado"),
            metodo_deteccion=draft.get("metodo_deteccion"),
            tool_source=draft.get("tool_source"),
            tool_vuln_id=draft.get("tool_vuln_id"),
            propuesta_remediacion=draft.get("propuesta_remediacion"),
            referencias=draft.get("referencias"),
            epss_score=draft.get("epss_score"),
            kev_listed=bool(draft.get("kev_listed")),
            catalog_id=resolve_finding_catalog_fk(
                draft.get("catalog_vulns_id") or draft.get("catalog_id"),
                valid_catalog_ids,
            ),
            engagement_id=engagement_id,
            status=FindingStatus.abierta,
            dedup_fingerprint=fp,
            first_seen=now,
            last_seen=now,
            updated_at=now,
            detection_sources=detection_sources or None,
            global_status=SERVICE_DRAFT_STATUS,
        )
        if not fast_rescan and tenant_id and isinstance(import_ctx, dict) and import_ctx:
            enrich_finding_import_context(db, new_finding, tenant_id=tenant_id)
        db.add(new_finding)
        pending_new += 1
        if fast_rescan and pending_new % 500 == 0:
            db.flush()
        elif not fast_rescan:
            db.flush()
        append_finding_history(
            db,
            new_finding,
            "rescan_new",
            {"scan_run_id": str(scan_run.id), "fingerprint": fp},
            actor=actor,
        )
        by_fp[fp] = new_finding
        stats["new_count"] += 1

    for fp, finding in by_fp.items():
        if fp in seen_fps:
            continue
        if finding.status not in BASELINE_ACTIVE_STATUSES:
            continue
        prev = finding.status.value
        finding.status = absent_status
        append_finding_history(
            db,
            finding,
            "rescan_absent",
            {
                "scan_run_id": str(scan_run.id),
                "from_status": prev,
                "to_status": absent_status.value,
                "fingerprint": fp,
            },
            actor=actor,
        )
        stats["absent_count"] += 1

    scan_run.stats = stats
    db.commit()
    return stats
