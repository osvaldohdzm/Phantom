"""Elimina un engagement y sus dependencias en el orden correcto."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.core import Asset, Engagement, Finding, RemediationPlan
from app.models.execution_log import ExecutionLog
from app.models.reports import ReportJob
from app.models.scan import AssetScanTarget, ScanRun
from app.models.scope import ScopeSnapshot
from app.models.vault import VaultCredential
from app.models.workspace import PhantomWorkspace
from app.services.report_job_cleanup import remove_report_job_files


def delete_engagement_dependencies(db: Session, engagement_id: UUID) -> None:
    """Borra registros hijos que bloquean DELETE en engagements."""
    jobs = db.query(ReportJob).filter(ReportJob.engagement_id == engagement_id).all()
    for job in jobs:
        remove_report_job_files(job)
        db.delete(job)

    finding_ids = [
        row[0]
        for row in db.query(Finding.id).filter(Finding.engagement_id == engagement_id).all()
    ]
    if finding_ids:
        db.query(RemediationPlan).filter(
            RemediationPlan.finding_id.in_(finding_ids)
        ).delete(synchronize_session=False)
        db.query(Finding).filter(Finding.id.in_(finding_ids)).delete(
            synchronize_session=False
        )

    db.query(ExecutionLog).filter(
        ExecutionLog.engagement_id == engagement_id,
        ExecutionLog.parent_log_id.isnot(None),
    ).update({ExecutionLog.parent_log_id: None}, synchronize_session=False)
    db.query(ExecutionLog).filter(ExecutionLog.engagement_id == engagement_id).delete(
        synchronize_session=False
    )
    db.query(ScopeSnapshot).filter(ScopeSnapshot.engagement_id == engagement_id).delete(
        synchronize_session=False
    )
    db.query(ScanRun).filter(ScanRun.engagement_id == engagement_id).delete(
        synchronize_session=False
    )
    db.query(AssetScanTarget).filter(AssetScanTarget.engagement_id == engagement_id).delete(
        synchronize_session=False
    )
    db.query(Asset).filter(Asset.engagement_id == engagement_id).update(
        {Asset.engagement_id: None}, synchronize_session=False
    )
    db.query(VaultCredential).filter(VaultCredential.engagement_id == engagement_id).update(
        {VaultCredential.engagement_id: None}, synchronize_session=False
    )
    db.query(PhantomWorkspace).filter(
        PhantomWorkspace.engagement_id == engagement_id
    ).update({PhantomWorkspace.engagement_id: None}, synchronize_session=False)


def delete_engagement(db: Session, engagement: Engagement) -> None:
    delete_engagement_dependencies(db, engagement.id)
    db.delete(engagement)
