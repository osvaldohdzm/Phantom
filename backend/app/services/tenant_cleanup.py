"""Elimina datos operativos de un tenant (gestión vulnerable) sin tocar catálogos globales."""

from __future__ import annotations

import shutil
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth import AuditEvent
from app.models.core import Asset, Engagement, Finding
from app.models.evidence import EvidenceAttachment
from app.models.reports import DocxTemplate
from app.models.scan import AssetGroup, AssetGroupMember, AssetScanTarget, ScanRun
from app.models.vault import VaultCredential
from app.models.workspace import PhantomWorkspace
from app.services.engagement_cleanup import delete_engagement
from app.services.report_job_cleanup import delete_report_jobs_for_template

BRANDING_STORAGE = Path("storage/branding")


def _delete_vault_for_engagement(db: Session, engagement_id: UUID) -> int:
    creds = db.query(VaultCredential).filter(VaultCredential.engagement_id == engagement_id).all()
    for cred in creds:
        db.delete(cred)
    return len(creds)


def _delete_workspaces_for_engagement(db: Session, engagement_id: UUID) -> int:
    rows = (
        db.query(PhantomWorkspace)
        .filter(PhantomWorkspace.engagement_id == engagement_id)
        .all()
    )
    for ws in rows:
        db.delete(ws)
    return len(rows)


def _delete_evidence_files(db: Session, finding_ids: list[UUID]) -> int:
    if not finding_ids:
        return 0
    attachments = (
        db.query(EvidenceAttachment)
        .filter(EvidenceAttachment.finding_id.in_(finding_ids))
        .all()
    )
    for att in attachments:
        try:
            Path(att.file_path).unlink(missing_ok=True)
        except OSError:
            pass
    return len(attachments)


def purge_tenant_vuln_data(db: Session, tenant_id: UUID) -> dict[str, int]:
    """
    Borra proyectos, hallazgos, activos, plantillas, escaneos y branding del tenant.
    No modifica vulnerability_catalog ni ttp_catalog.
    """
    stats = {
        "engagements": 0,
        "findings": 0,
        "assets": 0,
        "scan_targets": 0,
        "scan_runs": 0,
        "asset_groups": 0,
        "vault_credentials": 0,
        "workspaces": 0,
        "docx_templates": 0,
        "evidence_files": 0,
    }

    engagements = db.query(Engagement).filter(Engagement.tenant_id == tenant_id).all()
    engagement_ids = [eg.id for eg in engagements]

    if engagement_ids:
        finding_ids = [
            row[0]
            for row in db.query(Finding.id)
            .filter(Finding.engagement_id.in_(engagement_ids))
            .all()
        ]
        stats["evidence_files"] = _delete_evidence_files(db, finding_ids)
        stats["findings"] = len(finding_ids)

    for eg in engagements:
        stats["vault_credentials"] += _delete_vault_for_engagement(db, eg.id)
        stats["workspaces"] += _delete_workspaces_for_engagement(db, eg.id)
        delete_engagement(db, eg)
        stats["engagements"] += 1

    stats["scan_targets"] = (
        db.query(AssetScanTarget)
        .filter(AssetScanTarget.tenant_id == tenant_id)
        .delete(synchronize_session=False)
    )
    stats["scan_runs"] = (
        db.query(ScanRun).filter(ScanRun.tenant_id == tenant_id).delete(synchronize_session=False)
    )

    group_ids = [
        row[0]
        for row in db.query(AssetGroup.id).filter(AssetGroup.tenant_id == tenant_id).all()
    ]
    if group_ids:
        db.query(AssetGroupMember).filter(AssetGroupMember.group_id.in_(group_ids)).delete(
            synchronize_session=False
        )
    stats["asset_groups"] = (
        db.query(AssetGroup).filter(AssetGroup.tenant_id == tenant_id).delete(synchronize_session=False)
    )

    asset_ids = [
        row[0] for row in db.query(Asset.id).filter(Asset.tenant_id == tenant_id).all()
    ]
    if asset_ids:
        stats["workspaces"] += (
            db.query(PhantomWorkspace)
            .filter(PhantomWorkspace.asset_id.in_(asset_ids))
            .delete(synchronize_session=False)
        )
        creds = db.query(VaultCredential).filter(VaultCredential.asset_id.in_(asset_ids)).all()
        for cred in creds:
            db.delete(cred)
        stats["vault_credentials"] += len(creds)

        assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
        for asset in assets:
            db.delete(asset)
        stats["assets"] = len(assets)

    templates = db.query(DocxTemplate).filter(DocxTemplate.tenant_id == tenant_id).all()
    for tpl in templates:
        delete_report_jobs_for_template(db, tpl.id)
        try:
            Path(tpl.file_path).unlink(missing_ok=True)
        except OSError:
            pass
        db.delete(tpl)
    stats["docx_templates"] = len(templates)

    branding_dir = BRANDING_STORAGE / str(tenant_id)
    if branding_dir.is_dir():
        shutil.rmtree(branding_dir, ignore_errors=True)

    db.query(AuditEvent).filter(AuditEvent.tenant_id == tenant_id).delete(
        synchronize_session=False
    )

    db.flush()
    return stats
