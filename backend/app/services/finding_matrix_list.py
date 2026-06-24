"""Serialización ligera de hallazgos para la matriz CYB001 (listas masivas)."""

from __future__ import annotations

from app.models.core import Finding
from app.schemas import FindingRead

_MATRIX_LIST_OMIT = frozenset(
    {
        "lifecycle_history",
        "detection_sources",
        "origin_projects",
        "remediation_context",
        "ai_summary",
        "ai_group_id",
        "dedup_fingerprint",
    }
)

_MATRIX_RAW_TRUNCATE = 4096


def serialize_finding_matrix(finding: Finding) -> dict:
    """Payload reducido sin reparación de catálogo por fila (evita N consultas en 50k+ filas)."""
    data = FindingRead.model_validate(finding).model_dump()
    for key in _MATRIX_LIST_OMIT:
        data.pop(key, None)
    raw = data.get("raw_tool_output")
    if isinstance(raw, str) and len(raw) > _MATRIX_RAW_TRUNCATE:
        data["raw_tool_output"] = raw[:_MATRIX_RAW_TRUNCATE]
    return data
