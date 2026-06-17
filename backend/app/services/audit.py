from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth import AuditEvent


def log_audit_event(
    db: Session,
    *,
    action: str,
    actor_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        AuditEvent(
            action=action,
            actor_id=actor_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            details=details,
        )
    )
