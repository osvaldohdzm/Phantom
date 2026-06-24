"""Alcance de hallazgos entre flujo de servicio y gestión de vulnerabilidades."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Query

from app.models.core import Finding

# Borrador: visible en pasos del servicio, oculto en gestión de vulnerabilidades.
SERVICE_DRAFT_STATUS = "BORRADOR_SERVICIO"
# Publicado en el repositorio operativo del tenant.
REPOSITORY_STATUS = "REPOSITORIO"


def apply_repository_list_filter(query: Query, engagement_id: Optional[UUID]) -> Query:
    """Sin engagement_id = vista repositorio global: excluir borradores de servicio."""
    if engagement_id is not None:
        return query
    return query.filter(
        (Finding.global_status.is_(None)) | (Finding.global_status != SERVICE_DRAFT_STATUS)
    )
