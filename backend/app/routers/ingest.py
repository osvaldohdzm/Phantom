from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, require_engagement_tenant, require_write
from app.models.core import Engagement, Finding, FindingStatus
from app.schemas import IngestBatchResponse, NessusRescanResponse
from app.services.parse_acunetix_html import parse_acunetix_html_bytes
from app.services.parse_nessus_csv import parse_nessus_csv_bytes
from app.services.parse_nmap_scan import parse_nmap_bytes
from app.services.parse_universal_csv import parse_universal_csv_bytes
from app.services.catalog_from_draft import ensure_drafts_catalog
from app.services.dedup_fingerprint import build_dedup_fingerprint_from_draft
from app.services.finding_import_enrich import enrich_finding_import_context
from app.services.finding_history import append_finding_history
from app.services.asset_scan_targets import refresh_scan_targets
from app.services.finding_rescan import apply_nessus_rescan
from app.services.ingest_common import load_vulnerabilities_catalog_ids, resolve_finding_catalog_fk
from app.services.vulns_catalog_lookup import enrich_drafts_with_catalog
from app.models.scan import ScanRun
from app.deps.auth import actor_email

router = APIRouter(prefix="/ingest", tags=["ingest"])

MAX_FILE_MB = 150


async def _read_upload(file: UploadFile) -> bytes:
    raw = await file.read()
    if len(raw) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Archivo mayor a {MAX_FILE_MB} MB")
    return raw


def _persist_drafts(
    db: Session,
    drafts: list[dict],
    engagement_id: Optional[UUID],
    tenant_id: Optional[UUID] = None,
) -> list[UUID]:
    if engagement_id is not None:
        eg = db.get(Engagement, engagement_id)
        if not eg:
            raise HTTPException(status_code=404, detail="Engagement no encontrado")

    ids: list[UUID] = []
    chunk: list[Finding] = []
    valid_catalog_ids = load_vulnerabilities_catalog_ids(db)
    now = datetime.now(timezone.utc)
    for d in drafts:
        detection_sources: list[dict] = []
        import_ctx = d.get("import_context")
        if isinstance(import_ctx, dict) and import_ctx:
            detection_sources.append(
                {
                    **import_ctx,
                    "source": d.get("tool_source") or "universal-csv",
                    "at": now.isoformat(),
                }
            )

        origin_projects: list[dict] = []
        csv_project = d.get("csv_project")
        if csv_project:
            first_seen = d.get("first_seen") or now
            first_iso = first_seen.isoformat() if isinstance(first_seen, datetime) else str(first_seen)
            origin_projects.append(
                {
                    "name": str(csv_project)[:255],
                    "engagement_id": str(engagement_id) if engagement_id else None,
                    "first_seen": first_iso,
                    "last_seen": now.isoformat(),
                }
            )

        finding_status = d.get("finding_status") or FindingStatus.abierta
        first_seen_val = d.get("first_seen")
        if not isinstance(first_seen_val, datetime):
            first_seen_val = now
        last_seen_val = d.get("last_seen")
        if not isinstance(last_seen_val, datetime):
            last_seen_val = now

        f = Finding(
            titulo=d["titulo"],
            descripcion=d.get("descripcion"),
            severidad=d["severidad"],
            cvss_score=d.get("cvss_score"),
            cvss_vector=d.get("cvss_vector"),
            cve=d.get("cve"),
            cwe=d.get("cwe"),
            raw_tool_output=d.get("raw_tool_output"),
            explicacion_tecnica=d.get("explicacion_tecnica"),
            amenaza_ampliada=d.get("amenaza_ampliada"),
            componente_afectado=d.get("componente_afectado"),
            metodo_deteccion=d.get("metodo_deteccion"),
            tool_source=d.get("tool_source"),
            tool_vuln_id=d.get("tool_vuln_id"),
            propuesta_remediacion=d.get("propuesta_remediacion"),
            referencias=d.get("referencias"),
            epss_score=d.get("epss_score"),
            kev_listed=bool(d.get("kev_listed")),
            catalog_id=resolve_finding_catalog_fk(
                d.get("catalog_vulns_id") or d.get("catalog_id"),
                valid_catalog_ids,
            ),
            engagement_id=engagement_id,
            status=finding_status,
            first_seen=first_seen_val,
            last_seen=last_seen_val,
            updated_at=now,
            dedup_fingerprint=build_dedup_fingerprint_from_draft(d),
            remediation_context=d.get("remediation_context"),
            detection_sources=detection_sources or None,
            origin_projects=origin_projects or None,
        )
        if tenant_id and import_ctx:
            enrich_finding_import_context(db, f, tenant_id=tenant_id)
        chunk.append(f)
        if len(chunk) >= 250:
            for x in chunk:
                db.add(x)
            db.commit()
            for x in chunk:
                db.refresh(x)
                append_finding_history(
                    db,
                    x,
                    "ingest",
                    {"tool_source": x.tool_source, "engagement_id": str(engagement_id) if engagement_id else None},
                )
                ids.append(x.id)
            db.commit()
            chunk.clear()
    for x in chunk:
        db.add(x)
    db.commit()
    for x in chunk:
        db.refresh(x)
        append_finding_history(
            db,
            x,
            "ingest",
            {"tool_source": x.tool_source, "engagement_id": str(engagement_id) if engagement_id else None},
        )
        ids.append(x.id)
    db.commit()
    return ids


def _refresh_asset_targets_after_ingest(
    db: Session, engagement_id: Optional[UUID], tenant_id: UUID
) -> None:
    if engagement_id is None:
        return
    try:
        refresh_scan_targets(db, tenant_id=tenant_id, engagement_id=engagement_id)
    except Exception:
        pass  # no bloquear ingest por cola de activos


def _ingest_catalog_message(
    total: int,
    enrich_hits: int,
    stats: dict[str, int],
) -> str | None:
    parts: list[str] = []
    if enrich_hits:
        parts.append(f"{enrich_hits} enriquecidos desde catálogo existente")
    created = stats.get("created", 0)
    linked = stats.get("linked", 0) + stats.get("merged", 0)
    if created:
        parts.append(f"{created} entradas nuevas en catálogo")
    if linked:
        parts.append(f"{linked} vinculados al catálogo")
    skipped = stats.get("skipped", 0)
    if skipped:
        parts.append(f"{skipped} sin índice de herramienta (revisar manual)")
    if not parts:
        return None
    return f"Catálogo: {' · '.join(parts)} · {total} hallazgos importados."


def _require_engagement_id(engagement_id: Optional[UUID]) -> UUID:
    if engagement_id is None:
        raise HTTPException(
            status_code=400,
            detail="engagement_id es obligatorio: selecciona o guarda un proyecto antes de importar",
        )
    return engagement_id


def _assert_ingest_access(db: Session, engagement_id: UUID, ctx: AuthContext) -> None:
    require_engagement_tenant(db, engagement_id, ctx.tenant_id)


@router.post("/nessus-csv", response_model=IngestBatchResponse)
async def ingest_nessus_csv(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> IngestBatchResponse:
    engagement_id = _require_engagement_id(engagement_id)
    _assert_ingest_access(db, engagement_id, ctx)
    data = await _read_upload(file)
    drafts = parse_nessus_csv_bytes(data)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se extrajeron filas del CSV. Comprueba que sea export Nessus/Tenable (.csv).",
        )
    catalog_hits = enrich_drafts_with_catalog(db, drafts)
    catalog_stats = ensure_drafts_catalog(db, drafts)
    ids = _persist_drafts(db, drafts, engagement_id, ctx.tenant_id)
    _refresh_asset_targets_after_ingest(db, engagement_id, ctx.tenant_id)
    msg = _ingest_catalog_message(len(drafts), catalog_hits, catalog_stats)
    return IngestBatchResponse(
        source="nessus-csv",
        created_count=len(ids),
        finding_ids=ids,
        message=msg,
    )


@router.post("/nessus-csv/rescan", response_model=NessusRescanResponse)
async def ingest_nessus_csv_rescan(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    scope: str = Form("tenant"),
    absent_policy: str = Form("atendido"),
    label: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> NessusRescanResponse:
    """Re-escaneo AV: compara con hallazgos existentes y actualiza estados (sin duplicar)."""
    engagement_id = _require_engagement_id(engagement_id)
    _assert_ingest_access(db, engagement_id, ctx)

    if scope not in ("tenant", "engagement"):
        raise HTTPException(status_code=400, detail="scope debe ser 'tenant' o 'engagement'")
    if absent_policy not in ("atendido", "remediado"):
        raise HTTPException(status_code=400, detail="absent_policy debe ser 'atendido' o 'remediado'")

    data = await _read_upload(file)
    drafts = parse_nessus_csv_bytes(data)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se extrajeron filas del CSV. Comprueba que sea export Nessus/Tenable (.csv).",
        )

    enrich_drafts_with_catalog(db, drafts)
    ensure_drafts_catalog(db, drafts)

    scan_run = ScanRun(
        tenant_id=ctx.tenant_id,
        engagement_id=engagement_id,
        tool_source="Nessus",
        label=label or file.filename,
        file_name=file.filename,
        scope=scope,
        absent_policy=absent_policy,
    )
    db.add(scan_run)
    db.flush()

    stats = apply_nessus_rescan(
        db,
        drafts=drafts,
        tenant_id=ctx.tenant_id,
        engagement_id=engagement_id,
        scope=scope,
        absent_policy=absent_policy,
        scan_run=scan_run,
        actor=actor_email(ctx),
    )
    _refresh_asset_targets_after_ingest(db, engagement_id, ctx.tenant_id)

    parts = [
        f"{stats['new_count']} nuevas",
        f"{stats['updated_count']} actualizadas",
        f"{stats['reaparecido_count']} reaparecidas",
        f"{stats['absent_count']} ausentes → {absent_policy}",
    ]
    return NessusRescanResponse(
        scan_run_id=scan_run.id,
        scope=scope,
        absent_policy=absent_policy,
        new_count=stats["new_count"],
        updated_count=stats["updated_count"],
        reaparecido_count=stats["reaparecido_count"],
        absent_count=stats["absent_count"],
        total_in_scan=stats["total_in_scan"],
        message=" · ".join(parts),
    )


@router.post("/acunetix-html", response_model=IngestBatchResponse)
async def ingest_acunetix_html(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> IngestBatchResponse:
    engagement_id = _require_engagement_id(engagement_id)
    _assert_ingest_access(db, engagement_id, ctx)
    data = await _read_upload(file)
    drafts = parse_acunetix_html_bytes(data)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se encontraron tablas de alertas reconocibles. Exporta el informe HTML con la tabla de vulnerabilidades.",
        )
    catalog_hits = enrich_drafts_with_catalog(db, drafts)
    catalog_stats = ensure_drafts_catalog(db, drafts)
    ids = _persist_drafts(db, drafts, engagement_id, ctx.tenant_id)
    _refresh_asset_targets_after_ingest(db, engagement_id, ctx.tenant_id)
    msg = _ingest_catalog_message(len(drafts), catalog_hits, catalog_stats)
    return IngestBatchResponse(
        source="acunetix-html",
        created_count=len(ids),
        finding_ids=ids,
        message=msg,
    )


@router.post("/nmap", response_model=IngestBatchResponse)
async def ingest_nmap(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> IngestBatchResponse:
    engagement_id = _require_engagement_id(engagement_id)
    _assert_ingest_access(db, engagement_id, ctx)
    data = await _read_upload(file)
    name = file.filename or "scan"
    drafts = parse_nmap_bytes(data, name)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se detectaron puertos abiertos. Usa salida XML (-oX), .gnmap o texto estándar de Nmap.",
        )
    catalog_hits = enrich_drafts_with_catalog(db, drafts)
    catalog_stats = ensure_drafts_catalog(db, drafts)
    ids = _persist_drafts(db, drafts, engagement_id, ctx.tenant_id)
    _refresh_asset_targets_after_ingest(db, engagement_id, ctx.tenant_id)
    msg = _ingest_catalog_message(len(drafts), catalog_hits, catalog_stats)
    if not msg:
        msg = "Hallazgos creados con severidad Info (inventario de superficie)."
    else:
        msg = f"{msg} Severidad Info (inventario de superficie)."
    return IngestBatchResponse(
        source="nmap",
        created_count=len(ids),
        finding_ids=ids,
        message=msg,
    )


def _parse_column_map_form(raw: Optional[str]) -> dict[str, str] | None:
    if not raw or not raw.strip():
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"column_map JSON inválido: {exc}") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="column_map debe ser un objeto JSON")
    return {str(k): str(v) for k, v in parsed.items()}


@router.post("/universal-csv", response_model=IngestBatchResponse)
async def ingest_universal_csv(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    column_map: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> IngestBatchResponse:
    engagement_id = _require_engagement_id(engagement_id)
    _assert_ingest_access(db, engagement_id, ctx)
    data = await _read_upload(file)
    user_map = _parse_column_map_form(column_map)
    drafts, resolved_map = parse_universal_csv_bytes(data, user_map)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se extrajeron filas del CSV. Comprueba encabezados (se requiere columna de título).",
        )
    catalog_hits = enrich_drafts_with_catalog(db, drafts)
    catalog_stats = ensure_drafts_catalog(db, drafts)
    ids = _persist_drafts(db, drafts, engagement_id, ctx.tenant_id)
    _refresh_asset_targets_after_ingest(db, engagement_id, ctx.tenant_id)
    msg = _ingest_catalog_message(len(drafts), catalog_hits, catalog_stats)
    return IngestBatchResponse(
        source="universal-csv",
        created_count=len(ids),
        finding_ids=ids,
        message=msg,
        column_map=resolved_map or None,
    )
