import uuid
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import (
    AuthContext,
    actor_email,
    ensure_findings_in_tenant,
    filter_engagement_ids,
    get_report_job_in_tenant,
    get_template_in_tenant,
    get_auth_context,
    require_engagement_tenant,
    require_write,
    tenant_findings_filter,
    tenant_report_jobs_query,
)
from app.models.core import Engagement, Finding, FindingStatus
from app.models.reports import DocxTemplate, ReportJob, ReportJobStatus, ReportKind
from app.schemas import (
    DocxTemplateRead,
    GenerateDocxReportRequest,
    GenerateDocxReportResponse,
    ReportJobListItem,
    ReportJobRead,
)
from app.services.docx_generator import extract_placeholders_from_docx
from app.services.report_docx_worker import start_report_job_thread
from app.services.report_job_cleanup import delete_report_job, delete_report_jobs_for_template

router = APIRouter(prefix="/docx-templates", tags=["docx-templates"])

STORAGE_DIR = Path("storage/templates")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
MAX_TEMPLATE_MB = 20


@router.get("", response_model=List[DocxTemplateRead])
def list_templates(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[DocxTemplate]:
    return (
        db.query(DocxTemplate)
        .filter(DocxTemplate.tenant_id == ctx.tenant_id)
        .order_by(DocxTemplate.created_at.desc())
        .all()
    )


@router.post("", response_model=DocxTemplateRead)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> DocxTemplate:
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos .docx")

    raw = await file.read()
    if len(raw) > MAX_TEMPLATE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Plantilla mayor a {MAX_TEMPLATE_MB} MB")

    template_id = uuid.uuid4()
    file_path = STORAGE_DIR / f"{template_id}.docx"
    file_path.write_bytes(raw)

    try:
        placeholders = extract_placeholders_from_docx(str(file_path))
    except Exception:
        placeholders = []

    tpl = DocxTemplate(
        id=template_id,
        name=name,
        description=description,
        file_path=str(file_path),
        placeholders=placeholders,
        created_by=actor_email(ctx),
        tenant_id=ctx.tenant_id,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.post("/generate", response_model=GenerateDocxReportResponse)
def generate_docx_report(
    payload: GenerateDocxReportRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> GenerateDocxReportResponse:
    tpl = get_template_in_tenant(db, payload.template_id, ctx.tenant_id)
    if not Path(tpl.file_path).exists():
        raise HTTPException(status_code=404, detail="Archivo de plantilla no encontrado")

    if payload.engagement_id:
        require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)

    query = tenant_findings_filter(db.query(Finding), ctx.tenant_id)
    if payload.finding_ids:
        query = query.filter(Finding.id.in_(payload.finding_ids))
    elif payload.engagement_id:
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

    job = ReportJob(
        template_id=tpl.id,
        engagement_id=payload.engagement_id,
        status=ReportJobStatus.processing,
        finding_ids=[str(f.id) for f in findings],
        findings_count=len(findings),
        created_by=actor_email(ctx),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    start_report_job_thread(job.id)

    return GenerateDocxReportResponse(
        job_id=job.id,
        status=job.status.value,
        findings_count=job.findings_count,
        consolidated_download_url=f"/api/v1/docx-templates/jobs/{job.id}/download",
        individual_count=0,
        message=(
            f"Generación iniciada para {job.findings_count} hallazgos. "
            "Puede tardar varios minutos; el documento estará listo al completar."
        ),
    )


@router.get("/jobs", response_model=List[ReportJobListItem])
def list_report_jobs(
    engagement_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[ReportJobListItem]:
    eg_ids = list(filter_engagement_ids(db, ctx.tenant_id))
    if not eg_ids:
        return []
    query = tenant_report_jobs_query(db, ctx.tenant_id).order_by(ReportJob.created_at.desc())
    if engagement_id:
        require_engagement_tenant(db, engagement_id, ctx.tenant_id)
        query = query.filter(ReportJob.engagement_id == engagement_id)
    jobs = query.limit(50).all()
    if not jobs:
        return []

    template_ids = {j.template_id for j in jobs if j.template_id is not None}
    templates = {
        t.id: t.name
        for t in db.query(DocxTemplate)
        .filter(DocxTemplate.id.in_(template_ids), DocxTemplate.tenant_id == ctx.tenant_id)
        .all()
    }

    items: List[ReportJobListItem] = []
    for job in jobs:
        status = job.status.value if hasattr(job.status, "value") else str(job.status)
        has_file = bool(job.output_path and Path(job.output_path).exists())
        kind = job.report_kind.value if hasattr(job.report_kind, "value") else str(job.report_kind)
        if kind == ReportKind.findings_table.value:
            template_name = "Tabla de hallazgos (CYB001)"
            individual_count = 0
            grouped_rows = job.grouped_rows
        else:
            template_name = templates.get(job.template_id, "Plantilla eliminada")
            individual_count = len(job.individual_paths or [])
            grouped_rows = None
        items.append(
            ReportJobListItem(
                id=job.id,
                engagement_id=job.engagement_id,
                template_id=job.template_id,
                report_kind=kind,
                template_name=template_name,
                status=status,
                findings_count=job.findings_count,
                individual_count=individual_count,
                grouped_rows=grouped_rows,
                created_at=job.created_at,
                completed_at=job.completed_at,
                consolidated_download_url=(
                    f"/api/v1/docx-templates/jobs/{job.id}/download"
                    if status == ReportJobStatus.completed.value and has_file
                    else None
                ),
                error_message=job.error_message,
            )
        )
    return items


@router.delete("/jobs/{job_id}")
def delete_report_job_endpoint(
    job_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    job = get_report_job_in_tenant(db, job_id, ctx.tenant_id)
    delete_report_job(db, job)
    return {"deleted": True, "id": str(job_id)}


@router.get("/jobs/{job_id}", response_model=ReportJobRead)
def get_report_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> ReportJob:
    return get_report_job_in_tenant(db, job_id, ctx.tenant_id)


@router.get("/jobs/{job_id}/download")
def download_consolidated_report(
    job_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    job = get_report_job_in_tenant(db, job_id, ctx.tenant_id)
    if not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    kind = job.report_kind.value if hasattr(job.report_kind, "value") else str(job.report_kind)
    filename = (
        "Tabla_de_hallazgos.docx"
        if kind == ReportKind.findings_table.value
        else "Tablas_detalles_vulnerabilidades.docx"
    )
    return FileResponse(
        job.output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )


@router.get("/jobs/{job_id}/download/{index}")
def download_individual_report(
    job_id: UUID,
    index: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    job = get_report_job_in_tenant(db, job_id, ctx.tenant_id)
    if not job.individual_paths:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    if index < 1 or index > len(job.individual_paths):
        raise HTTPException(status_code=404, detail="Índice fuera de rango")
    path = job.individual_paths[index - 1]
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"Tabla_{index}.docx",
    )


@router.get("/{template_id}", response_model=DocxTemplateRead)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> DocxTemplate:
    return get_template_in_tenant(db, template_id, ctx.tenant_id)


@router.delete("/{template_id}")
def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    tpl = get_template_in_tenant(db, template_id, ctx.tenant_id)
    jobs_removed = delete_report_jobs_for_template(db, template_id)
    try:
        Path(tpl.file_path).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(tpl)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "No se pudo eliminar la plantilla: aún hay reportes Word asociados. "
                "Elimínalos del historial de reportes e intenta de nuevo."
            ),
        )
    return {
        "deleted": True,
        "id": str(template_id),
        "jobs_removed": jobs_removed,
    }


@router.get("/{template_id}/download")
def download_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    tpl = get_template_in_tenant(db, template_id, ctx.tenant_id)
    if not Path(tpl.file_path).exists():
        raise HTTPException(status_code=404, detail="Archivo de plantilla no encontrado")
    return FileResponse(
        tpl.file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"{tpl.name}.docx",
    )
