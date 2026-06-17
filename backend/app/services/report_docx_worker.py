"""Generación de reportes Word en segundo plano (evita timeout HTTP)."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from uuid import UUID

from app.database import SessionLocal
from app.models.core import Asset, Engagement, Finding, VulnerabilityCatalog
from app.models.reports import DocxTemplate, ReportJob, ReportJobStatus
from app.services.docx_generator import docx_report_generator
from app.services.finding_catalog_sync import sync_findings_from_operational_catalog
from app.services.finding_text_repair import repair_findings_text

logger = logging.getLogger(__name__)


def run_report_job(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.get(ReportJob, job_id)
        if not job:
            logger.error("Report job %s not found", job_id)
            return

        tpl = db.get(DocxTemplate, job.template_id)
        if not tpl:
            raise FileNotFoundError("Plantilla no encontrada")

        finding_ids = [UUID(fid) for fid in (job.finding_ids or [])]
        findings = (
            db.query(Finding)
            .filter(Finding.id.in_(finding_ids))
            .order_by(Finding.created_at.asc())
            .all()
        )
        if not findings:
            raise ValueError("No hay hallazgos para este job")

        sync_findings_from_operational_catalog(db, findings, force=True, persist=True)
        repair_findings_text(findings, db)

        engagement = db.get(Engagement, job.engagement_id) if job.engagement_id else None

        asset_ids = {f.asset_id for f in findings if f.asset_id}
        assets_map = {}
        if asset_ids:
            for asset in db.query(Asset).filter(Asset.id.in_(asset_ids)).all():
                assets_map[asset.id] = asset

        catalog_ids = {f.catalog_id for f in findings if f.catalog_id}
        catalogs_map = {}
        if catalog_ids:
            for cat in db.query(VulnerabilityCatalog).filter(VulnerabilityCatalog.Id.in_(catalog_ids)).all():
                catalogs_map[cat.Id] = cat

        result = docx_report_generator.generate_batch(
            template_path=tpl.file_path,
            findings=findings,
            assets_map=assets_map,
            engagement=engagement,
            catalogs_map=catalogs_map,
            job_id=job.id,
            db=db,
        )

        job.status = ReportJobStatus.completed
        job.output_path = result["consolidated_path"]
        job.individual_paths = result["individual_paths"]
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None
        db.commit()
        logger.info("Report job %s completed (%s findings)", job_id, len(findings))
    except Exception as exc:
        logger.exception("Report job %s failed", job_id)
        try:
            job = db.get(ReportJob, job_id)
            if job:
                job.status = ReportJobStatus.failed
                job.error_message = str(exc)
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


def start_report_job_thread(job_id: UUID) -> None:
    thread = threading.Thread(
        target=run_report_job,
        args=(job_id,),
        name=f"report-job-{job_id}",
        daemon=True,
    )
    thread.start()
