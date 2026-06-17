"""Asigna ai_group_id por título normalizado dentro de un engagement (heurística local)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.core import Finding
from app.services.finding_grouping import normalize_grouping_title
from app.services.finding_history import append_finding_history


def assign_ai_groups_for_engagement(
    db: Session,
    findings: list[Finding],
    *,
    actor: str | None = None,
) -> dict[str, Any]:
    """Agrupa hallazgos sin ai_group_id que comparten título normalizado."""
    buckets: dict[str, list[Finding]] = defaultdict(list)
    for finding in findings:
        if finding.ai_group_id:
            continue
        key = normalize_grouping_title(finding.titulo or "")
        if not key:
            continue
        buckets[key].append(finding)

    groups_created = 0
    assigned = 0
    for _key, members in buckets.items():
        if len(members) < 2:
            continue
        group_id = uuid4()
        groups_created += 1
        for finding in members:
            finding.ai_group_id = group_id
            append_finding_history(
                db,
                finding,
                "ai_group_assign",
                {"ai_group_id": str(group_id), "title_key": _key},
                actor=actor,
            )
            assigned += 1

    return {"assigned": assigned, "groups_created": groups_created}
