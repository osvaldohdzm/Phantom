"""Historial de ciclo de vida de hallazgos (JSONB en findings.lifecycle_history)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.core import Finding

_MAX_EVENTS = 100


def append_finding_history(
    db: Session,
    finding: Finding,
    event_type: str,
    detail: str | dict | None = None,
    actor: Optional[str] = None,
) -> None:
    history: list[dict[str, Any]] = list(finding.lifecycle_history or [])
    history.append(
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "type": event_type,
            "detail": detail,
            "actor": actor,
        }
    )
    finding.lifecycle_history = history[-_MAX_EVENTS:]
