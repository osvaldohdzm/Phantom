from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from app.deps.auth import (
    AuthContext,
    actor_email,
    ensure_findings_in_tenant,
    get_auth_context,
    get_finding_in_tenant,
    require_engagement_tenant,
    require_write,
    tenant_findings_filter,
)
from app.database import get_db
from app.models.core import Asset, Engagement, Finding, FindingStatus, RemediationPlan, Severity
from app.schemas import (
    AIEnrichRequest,
    AIEnrichResponse,
    BulkDeleteByQueryRequest,
    BulkDeleteRequest,
    BulkValidateRequest,
    ConsolidateMasterCatalogRequest,
    ConsolidateMasterCatalogResponse,
    FindingCreate,
    FindingRead,
    FindingStatusUpdate,
    FindingUpdate,
    SyncFromCatalogRequest,
    SyncFromCatalogResponse,
)
from app.services.ai_pipeline import enrich_finding
from app.services.assign_ai_groups import assign_ai_groups_for_engagement
from app.services.audit import log_audit_event
from app.services.finding_delete import delete_findings_by_ids
from app.services.finding_duplicates import find_duplicate_groups
from app.services.finding_history import append_finding_history
from app.services.master_catalog_consolidate import consolidate_findings_batch
from app.services.finding_project_summary import build_project_summary
from app.services.finding_catalog_sync import (
    findings_matching_catalog_entry,
    sync_findings_from_operational_catalog,
)
from app.services.finding_text_repair import (
    repair_and_persist_findings,
    repair_finding_text,
    repair_findings_text,
)

router = APIRouter(prefix="/findings", tags=["findings"])


def _touch_updated(finding: Finding, when: Optional[datetime] = None) -> None:
    finding.updated_at = when or datetime.now(timezone.utc)

MAX_FINDINGS_LIMIT = 50_000
DEFAULT_FINDINGS_LIMIT = 10_000

CLOSED_FINDING_STATUSES = (
    FindingStatus.cerrado,
    FindingStatus.falso_positivo,
    FindingStatus.riesgo_aceptado,
)


def _findings_query(
    db: Session,
    engagement_id: Optional[UUID],
    status: Optional[str],
    severidad: Optional[str],
    q: Optional[str] = None,
    *,
    tool_source: Optional[str] = None,
    require_engagement: bool = False,
    tenant_id: Optional[UUID] = None,
):
    query = db.query(Finding)
    if tenant_id is not None:
        query = tenant_findings_filter(query, tenant_id)
    if require_engagement and engagement_id is None:
        raise HTTPException(
            status_code=400,
            detail="engagement_id es obligatorio: los hallazgos están aislados por proyecto",
        )
    if engagement_id:
        if tenant_id is not None:
            require_engagement_tenant(db, engagement_id, tenant_id)
        query = query.filter(Finding.engagement_id == engagement_id)
    if status:
        try:
            query = query.filter(Finding.status == FindingStatus[status])
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    if severidad:
        key = severidad.strip().lower()
        try:
            query = query.filter(Finding.severidad == Severity[key])
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Severidad inválida: {severidad}")
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Finding.titulo.ilike(like),
                Finding.descripcion.ilike(like),
                Finding.componente_afectado.ilike(like),
                Finding.cve.ilike(like),
                Finding.raw_tool_output.ilike(like),
            )
        )
    if tool_source and tool_source.strip():
        query = query.filter(Finding.tool_source.ilike(tool_source.strip()))
    return query


def _parse_severidades(raw: Optional[str]) -> list[Severity]:
    if not raw or not raw.strip():
        return []
    out: list[Severity] = []
    for part in raw.split(","):
        key = part.strip().lower()
        if not key:
            continue
        try:
            out.append(Severity[key])
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=f"Severidad inválida: {part.strip()}") from exc
    return out


def _apply_findings_order(query, order_by: Optional[str]):
    key = (order_by or "created_at_desc").strip().lower()
    severity_rank = case(
        (Finding.severidad == Severity.critical, 0),
        (Finding.severidad == Severity.high, 1),
        (Finding.severidad == Severity.medium, 2),
        (Finding.severidad == Severity.low, 3),
        (Finding.severidad == Severity.info, 4),
        else_=5,
    )
    if key in ("severidad", "severidad_asc", "severity", "severity_asc"):
        return query.order_by(severity_rank.asc(), Finding.created_at.desc())
    if key in ("severidad_desc", "severity_desc"):
        return query.order_by(severity_rank.desc(), Finding.created_at.desc())
    if key in ("created_at", "created_at_desc", "created", "newest"):
        return query.order_by(Finding.created_at.desc())
    if key in ("created_at_asc", "oldest"):
        return query.order_by(Finding.created_at.asc())
    raise HTTPException(status_code=400, detail=f"order_by inválido: {order_by}")


@router.get("/count")
def count_findings(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
    engagement_id: Optional[UUID] = None,
    status: Optional[str] = None,
    severidad: Optional[str] = None,
    severidades: Optional[str] = None,
    q: Optional[str] = None,
    tool_source: Optional[str] = None,
) -> dict:
    query = _findings_query(
        db,
        engagement_id,
        status,
        severidad,
        q,
        tool_source=tool_source,
        require_engagement=False,
        tenant_id=ctx.tenant_id,
    )
    multi = _parse_severidades(severidades)
    if multi:
        query = query.filter(Finding.severidad.in_(multi))
    return {"total": query.count()}


@router.get("/stats/platform")
def platform_stats(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict:
    """KPIs agregados para el tablero (sin romper filtros por proyecto)."""
    base = tenant_findings_filter(db.query(Finding), ctx.tenant_id)
    open_q = base.filter(~Finding.status.in_(CLOSED_FINDING_STATUSES))

    by_severity: dict[str, int] = {}
    for sev in Severity:
        by_severity[sev.value] = base.filter(Finding.severidad == sev).count()

    return {
        "findings_total": base.count(),
        "findings_open": open_q.count(),
        "findings_critical_open": open_q.filter(Finding.severidad == Severity.critical).count(),
        "engagements_total": db.query(Engagement).filter(Engagement.tenant_id == ctx.tenant_id).count(),
        "assets_total": db.query(Asset).filter(Asset.tenant_id == ctx.tenant_id).count(),
        "by_severity": by_severity,
    }


@router.get("/project-summary")
def get_project_summary(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict:
    require_engagement_tenant(db, engagement_id, ctx.tenant_id)
    return build_project_summary(db, engagement_id)


@router.post("/deduplicate")
def deduplicate_findings(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    require_engagement_tenant(db, engagement_id, ctx.tenant_id)
    findings = db.query(Finding).filter(Finding.engagement_id == engagement_id).all()
    groups = find_duplicate_groups(findings)
    remove_ids: list[UUID] = []
    for g in groups:
        for uid in g["remove_ids"]:
            remove_ids.append(UUID(uid))
    if not remove_ids:
        return {"deleted_count": 0, "group_count": 0}
    deleted = (
        db.query(Finding)
        .filter(Finding.id.in_(remove_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted_count": deleted, "group_count": len(groups)}


@router.get("", response_model=list[FindingRead])
def list_findings(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
    skip: int = 0,
    limit: int = DEFAULT_FINDINGS_LIMIT,
    engagement_id: Optional[UUID] = None,
    status: Optional[str] = None,
    severidad: Optional[str] = None,
    severidades: Optional[str] = None,
    q: Optional[str] = None,
    tool_source: Optional[str] = None,
    order_by: Optional[str] = "created_at_desc",
) -> list[Finding]:
    if skip < 0:
        raise HTTPException(status_code=400, detail="skip debe ser >= 0")
    safe_limit = min(max(limit, 1), MAX_FINDINGS_LIMIT)
    query = _findings_query(
        db,
        engagement_id,
        status,
        severidad,
        q,
        tool_source=tool_source,
        require_engagement=False,
        tenant_id=ctx.tenant_id,
    )
    multi = _parse_severidades(severidades)
    if multi:
        query = query.filter(Finding.severidad.in_(multi))
    query = _apply_findings_order(query, order_by)
    findings = query.offset(skip).limit(safe_limit).all()
    return repair_findings_text(findings, db)


@router.post("/sync-from-catalog", response_model=SyncFromCatalogResponse)
def sync_findings_from_catalog_endpoint(
    payload: SyncFromCatalogRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> SyncFromCatalogResponse:
    """Trae los campos Esp* del catálogo operativo a los hallazgos (índice por herramienta + id)."""
    if payload.catalog_id:
        if payload.engagement_id is None:
            raise HTTPException(
                status_code=400,
                detail="engagement_id es obligatorio al sincronizar por catálogo",
            )
        require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)
        _cat, findings = findings_matching_catalog_entry(
            db,
            payload.catalog_id,
            engagement_id=payload.engagement_id,
        )
        if not _cat:
            raise HTTPException(status_code=404, detail="Registro de catálogo no encontrado")
        if payload.only_validated:
            findings = [f for f in findings if f.status == FindingStatus.validada]
    else:
        query = tenant_findings_filter(db.query(Finding), ctx.tenant_id)
        if payload.finding_ids:
            query = query.filter(Finding.id.in_(payload.finding_ids))
        elif payload.engagement_id:
            require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)
            query = query.filter(Finding.engagement_id == payload.engagement_id)
        else:
            raise HTTPException(status_code=400, detail="Indique finding_ids, engagement_id o catalog_id")

        if payload.only_validated:
            query = query.filter(Finding.status == FindingStatus.validada)

        findings = query.order_by(Finding.created_at.asc()).all()

    if not findings:
        raise HTTPException(status_code=404, detail="No hay hallazgos que cumplan los criterios")

    synced, skipped, errors = sync_findings_from_operational_catalog(
        db, findings, force=True, persist=True
    )
    repair_findings_text(findings, db)
    return SyncFromCatalogResponse(
        synced=synced,
        skipped=skipped,
        total=len(findings),
        errors=errors,
    )


@router.post("/consolidate-master-catalog", response_model=ConsolidateMasterCatalogResponse)
def consolidate_master_catalog_endpoint(
    payload: ConsolidateMasterCatalogRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> ConsolidateMasterCatalogResponse:
    """Consolida hallazgos validados en el catálogo maestro operativo con deduplicación indexada."""
    query = tenant_findings_filter(db.query(Finding), ctx.tenant_id)
    if payload.finding_ids:
        query = query.filter(Finding.id.in_(payload.finding_ids))
    elif payload.engagement_id:
        require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)
        query = query.filter(Finding.engagement_id == payload.engagement_id)
    else:
        raise HTTPException(
            status_code=400,
            detail="Indique finding_ids o engagement_id",
        )

    findings = query.order_by(Finding.created_at.asc()).all()
    if not findings:
        raise HTTPException(status_code=404, detail="No hay hallazgos que cumplan los criterios")

    result = consolidate_findings_batch(db, findings)
    log_audit_event(
        db,
        action="master_catalog_consolidate",
        actor_id=ctx.user.id,
        tenant_id=ctx.tenant_id,
        resource_type="finding",
        resource_id=str(payload.engagement_id or (payload.finding_ids or [""])[0]),
        details={
            "synced": result["synced"],
            "total": len(findings),
            "groups": result.get("groups", 0),
            "errors": result.get("errors", [])[:20],
        },
    )
    db.commit()

    return ConsolidateMasterCatalogResponse(
        synced=result["synced"],
        skipped=result["skipped"],
        total=len(findings),
        groups=result.get("groups", 0),
        errors=result.get("errors", []),
        details=result.get("details"),
    )


@router.post("/assign-ai-groups")
def assign_ai_groups_endpoint(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    """Asigna ai_group_id a hallazgos con el mismo título normalizado (sin llamada externa)."""
    require_engagement_tenant(db, engagement_id, ctx.tenant_id)
    findings = db.query(Finding).filter(Finding.engagement_id == engagement_id).all()
    if not findings:
        raise HTTPException(status_code=404, detail="No hay hallazgos en este proyecto")
    result = assign_ai_groups_for_engagement(db, findings, actor=actor_email(ctx))
    db.commit()
    return result


@router.post("/repair-text")
def repair_findings_text_endpoint(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    """Repara acentos/mojibake y rellena desde catálogo Nessus; persiste en BD."""
    require_engagement_tenant(db, engagement_id, ctx.tenant_id)
    findings = db.query(Finding).filter(Finding.engagement_id == engagement_id).all()
    if not findings:
        raise HTTPException(status_code=404, detail="No hay hallazgos en este proyecto")
    changed = repair_and_persist_findings(db, findings)
    return {"repaired_count": changed, "total": len(findings)}


@router.post("", response_model=FindingRead)
def create_finding(
    payload: FindingCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> Finding:
    if payload.engagement_id:
        require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)
    f = Finding(
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        severidad=Severity[payload.severidad.name],
        cvss_score=payload.cvss_score,
        cvss_vector=payload.cvss_vector,
        cve=payload.cve,
        cwe=payload.cwe,
        evidencia_url=payload.evidencia_url,
        asset_id=payload.asset_id,
        engagement_id=payload.engagement_id,
        catalog_id=payload.catalog_id,
        raw_tool_output=payload.raw_tool_output,
        explicacion_tecnica=payload.explicacion_tecnica,
        amenaza_ampliada=payload.amenaza_ampliada,
        componente_afectado=payload.componente_afectado,
        metodo_deteccion=payload.metodo_deteccion,
        tool_source=payload.tool_source,
        tool_vuln_id=payload.tool_vuln_id,
        propuesta_remediacion=payload.propuesta_remediacion,
        referencias=payload.referencias,
        status=FindingStatus.abierta,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return repair_finding_text(f, db)


@router.post("/bulk-validate", response_model=list[FindingRead])
def bulk_validate_findings(
    payload: BulkValidateRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> list[Finding]:
    findings = db.query(Finding).filter(Finding.id.in_(payload.finding_ids)).all()
    if not findings:
        raise HTTPException(status_code=404, detail="No se encontraron hallazgos")
    ensure_findings_in_tenant(db, findings, ctx.tenant_id)
    updated = []
    for f in findings:
        old_status = f.status
        f.status = FindingStatus.validada
        _touch_updated(f)
        remediation = db.query(RemediationPlan).filter(RemediationPlan.finding_id == f.id).first()
        if not remediation:
            remediation = RemediationPlan(finding_id=f.id, history=[])
            db.add(remediation)
        history = list(remediation.history) if remediation.history else []
        history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "from_status": old_status.value,
            "to_status": FindingStatus.validada.value,
            "user": actor_email(ctx),
            "notes": payload.notes or "Validación masiva",
        })
        remediation.history = history
        remediation.estado_remediacion = FindingStatus.validada.value
        append_finding_history(
            db,
            f,
            "status_change",
            {
                "from": old_status.value,
                "to": FindingStatus.validada.value,
                "notes": payload.notes or "Validación masiva",
            },
            actor=actor_email(ctx),
        )
        updated.append(f)
    db.commit()
    for f in updated:
        db.refresh(f)
    return repair_findings_text(updated, db)


@router.post("/bulk-delete")
def bulk_delete_findings(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    if not payload.finding_ids:
        raise HTTPException(status_code=400, detail="Lista de IDs vacía")
    findings = db.query(Finding).filter(Finding.id.in_(payload.finding_ids)).all()
    if not findings:
        raise HTTPException(status_code=404, detail="No se encontraron hallazgos")
    ensure_findings_in_tenant(db, findings, ctx.tenant_id)
    finding_ids = [f.id for f in findings]
    deleted = delete_findings_by_ids(db, finding_ids)
    db.commit()
    return {"deleted_count": deleted, "finding_ids": [str(fid) for fid in finding_ids]}


@router.post("/bulk-delete-by-query")
def bulk_delete_findings_by_query(
    payload: BulkDeleteByQueryRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    if payload.engagement_id is None:
        raise HTTPException(
            status_code=400,
            detail="engagement_id es obligatorio para borrar por consulta",
        )
    query = _findings_query(
        db,
        payload.engagement_id,
        None,
        payload.severidad,
        payload.q,
        require_engagement=True,
        tenant_id=ctx.tenant_id,
    )
    multi = _parse_severidades(payload.severidades)
    if multi:
        query = query.filter(Finding.severidad.in_(multi))
    finding_ids = [row[0] for row in query.with_entities(Finding.id).all()]
    deleted = delete_findings_by_ids(db, finding_ids)
    db.commit()
    return {"deleted_count": deleted}


@router.get("/{finding_id}", response_model=FindingRead)
def get_finding(
    finding_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> Finding:
    f = get_finding_in_tenant(db, finding_id, ctx.tenant_id)
    return repair_finding_text(f, db)


@router.patch("/{finding_id}", response_model=FindingRead)
def update_finding(
    finding_id: UUID,
    payload: FindingUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> Finding:
    f = get_finding_in_tenant(db, finding_id, ctx.tenant_id)
    data = payload.model_dump(exclude_unset=True)
    if "severidad" in data and data["severidad"] is not None:
        data["severidad"] = Severity[data["severidad"].name]
    touched = False
    if "seguimiento_estatus" in data:
        label = data.pop("seguimiento_estatus")
        sources = [dict(s) for s in (f.detection_sources or [])]
        if sources:
            sources[0] = {**sources[0], "seguimiento_estatus": label}
        else:
            sources = [{"source": "universal-csv", "seguimiento_estatus": label}]
        f.detection_sources = sources
        touched = True
    changed_keys = list(data.keys())
    for key, val in data.items():
        setattr(f, key, val)
    if changed_keys:
        touched = True
    if touched:
        _touch_updated(f)
    if changed_keys:
        append_finding_history(
            db,
            f,
            "update",
            {"fields": changed_keys},
            actor=actor_email(ctx),
        )
    db.commit()
    db.refresh(f)
    return repair_finding_text(f, db)


@router.patch("/{finding_id}/status", response_model=FindingRead)
def update_finding_status(
    finding_id: UUID,
    payload: FindingStatusUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> Finding:
    f = get_finding_in_tenant(db, finding_id, ctx.tenant_id)
    old_status = f.status
    new_status = FindingStatus[payload.status.name]
    f.status = new_status
    _touch_updated(f)

    remediation = db.query(RemediationPlan).filter(RemediationPlan.finding_id == finding_id).first()
    if not remediation:
        remediation = RemediationPlan(finding_id=finding_id, history=[])
        db.add(remediation)
    history = list(remediation.history) if remediation.history else []
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_status": old_status.value,
        "to_status": new_status.value,
        "user": actor_email(ctx),
        "notes": payload.notes,
    })
    remediation.history = history
    remediation.estado_remediacion = new_status.value
    append_finding_history(
        db,
        f,
        "status_change",
        {"from": old_status.value, "to": new_status.value, "notes": payload.notes},
        actor=actor_email(ctx),
    )
    db.commit()
    db.refresh(f)
    return repair_finding_text(f, db)


@router.post("/{finding_id}/ai-enrich", response_model=AIEnrichResponse)
def ai_enrich(
    finding_id: UUID,
    body: Optional[AIEnrichRequest] = Body(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AIEnrichResponse:
    f = get_finding_in_tenant(db, finding_id, ctx.tenant_id)
    raw = (body.raw_tool_output if body else None) or f.raw_tool_output or ""
    titulo = (body.titulo if body else None) or f.titulo
    comp = body.componente_afectado if body else None
    result = enrich_finding(raw, titulo, comp)
    f.explicacion_tecnica = str(result["explicacion_tecnica"])
    f.amenaza_ampliada = str(result["amenaza_ampliada"])
    f.owasp_category = str(result["owasp_top10"]) if result.get("owasp_top10") else None
    mitre = result.get("mitre_attack") or []
    f.mitre_technique_id = ",".join(mitre)[:512] if mitre else None
    append_finding_history(
        db,
        f,
        "ai_enrich",
        {"titulo": titulo},
        actor=actor_email(ctx),
    )
    db.add(f)
    db.commit()
    ow = result.get("owasp_top10")
    return AIEnrichResponse(
        explicacion_tecnica=str(result["explicacion_tecnica"]),
        amenaza_ampliada=str(result["amenaza_ampliada"]),
        owasp_top10=ow if isinstance(ow, str) else None,
        mitre_attack=list(result.get("mitre_attack") or []),
        sugerencia_remediacion=str(result.get("sugerencia_remediacion") or ""),
    )
