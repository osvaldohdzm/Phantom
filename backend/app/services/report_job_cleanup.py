"""Elimina archivos y registros de jobs de reporte Word."""

from __future__ import annotations

import shutil
from pathlib import Path

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.reports import ReportJob


def remove_report_job_files(job: ReportJob) -> None:
    paths: list[str] = []
    if job.output_path:
        paths.append(job.output_path)
    if job.individual_paths:
        paths.extend(job.individual_paths)
    seen_dirs: set[str] = set()
    for raw in paths:
        if not raw:
            continue
        p = Path(raw)
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
        parent = str(p.parent)
        if parent and parent not in seen_dirs:
            seen_dirs.add(parent)
    for parent in seen_dirs:
        try:
            shutil.rmtree(parent, ignore_errors=True)
        except OSError:
            pass


def delete_report_job(db: Session, job: ReportJob) -> None:
    remove_report_job_files(job)
    db.delete(job)
    db.commit()


def delete_report_jobs_for_template(db: Session, template_id: UUID) -> int:
    """Elimina jobs (y archivos) que referencian una plantilla antes de borrarla."""
    jobs = db.query(ReportJob).filter(ReportJob.template_id == template_id).all()
    for job in jobs:
        remove_report_job_files(job)
        db.delete(job)
    if jobs:
        db.flush()
    return len(jobs)
