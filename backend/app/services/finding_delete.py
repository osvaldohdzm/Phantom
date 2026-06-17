"""Elimina hallazgos y sus planes de remediación asociados."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.core import Finding, RemediationPlan


def delete_findings_by_ids(db: Session, finding_ids: list[UUID]) -> int:
    """Borra planes de remediación y hallazgos por ID. Devuelve cantidad borrada."""
    if not finding_ids:
        return 0
    db.query(RemediationPlan).filter(
        RemediationPlan.finding_id.in_(finding_ids)
    ).delete(synchronize_session=False)
    return db.query(Finding).filter(Finding.id.in_(finding_ids)).delete(
        synchronize_session=False
    )
