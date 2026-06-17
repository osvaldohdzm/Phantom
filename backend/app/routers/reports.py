import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pathlib import Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import (
    AuthContext,
    actor_email,
    get_auth_context,
    require_engagement_tenant,
    require_write,
    tenant_findings_filter,
)
from app.models.core import Asset, Finding, FindingStatus
from app.models.reports import ReportJob, ReportJobStatus, ReportKind
from app.schemas import GenerateFindingsTableRequest, GenerateFindingsTableResponse
from app.services.finding_catalog_sync import sync_findings_from_operational_catalog
from app.services.finding_grouping import prepare_grouped_rows_for_report
from app.services.finding_text_repair import repair_findings_text
from app.services.findings_table_generator import generate_findings_table_docx
from app.services.report_generator import report_generator

router = APIRouter(prefix="/reports", tags=["reports"])

FINDINGS_TABLE_DIR = Path("storage/reports/findings-table")
FINDINGS_TABLE_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_findings_for_report(
    db: Session,
    payload: GenerateFindingsTableRequest,
    tenant_id: UUID,
) -> list[Finding]:
    query = tenant_findings_filter(db.query(Finding), tenant_id)
    if payload.finding_ids:
        query = query.filter(Finding.id.in_(payload.finding_ids))
    elif payload.engagement_id:
        require_engagement_tenant(db, payload.engagement_id, tenant_id)
        query = query.filter(Finding.engagement_id == payload.engagement_id)
    else:
        raise HTTPException(status_code=400, detail="Indique finding_ids o engagement_id")

    if payload.only_validated:
        query = query.filter(Finding.status == FindingStatus.validada)

    if payload.status_filter:
        try:
            status_enum = FindingStatus[payload.status_filter]
            query = query.filter(Finding.status == status_enum)
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {payload.status_filter}")

    findings = query.order_by(Finding.created_at.asc()).all()
    if not findings:
        raise HTTPException(status_code=404, detail="No hay hallazgos que cumplan los criterios")
    return findings


@router.get("/engagement/{engagement_id}/html")
def get_html_report(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    require_engagement_tenant(db, engagement_id, ctx.tenant_id)
    try:
        html_content = report_generator.generate_html_report(engagement_id, db)
        return Response(content=html_content, media_type="text/html")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar el reporte: {str(e)}")


@router.post("/findings-table", response_model=GenerateFindingsTableResponse)
def generate_findings_table(
    payload: GenerateFindingsTableRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> GenerateFindingsTableResponse:
    findings = _resolve_findings_for_report(db, payload, ctx.tenant_id)
    sync_findings_from_operational_catalog(db, findings, force=True, persist=True)
    repair_findings_text(findings, db)

    asset_ids = {f.asset_id for f in findings if f.asset_id}
    assets_map = {}
    if asset_ids:
        for asset in (
            db.query(Asset)
            .filter(Asset.id.in_(asset_ids), Asset.tenant_id == ctx.tenant_id)
            .all()
        ):
            assets_map[asset.id] = asset

    grouped = prepare_grouped_rows_for_report(findings, assets_map)
    grouped_rows = len(grouped)

    job_id = uuid.uuid4()
    output_path = FINDINGS_TABLE_DIR / f"{job_id}.docx"
    generate_findings_table_docx(findings, assets_map, output_path=str(output_path))

    now = datetime.now(timezone.utc)
    job = ReportJob(
        id=job_id,
        engagement_id=payload.engagement_id,
        template_id=None,
        report_kind=ReportKind.findings_table,
        grouped_rows=grouped_rows,
        status=ReportJobStatus.completed,
        finding_ids=[str(f.id) for f in findings],
        findings_count=len(findings),
        output_path=str(output_path),
        created_by=actor_email(ctx),
        completed_at=now,
    )
    db.add(job)
    db.commit()

    return GenerateFindingsTableResponse(
        job_id=job_id,
        status=ReportJobStatus.completed.value,
        findings_count=len(findings),
        grouped_rows=grouped_rows,
        download_url=f"/api/v1/docx-templates/jobs/{job_id}/download",
        message=(
            f"Tabla de hallazgos generada: {grouped_rows} fila"
            f"{'' if grouped_rows == 1 else 's'} ({len(findings)} hallazgos)."
        ),
    )
