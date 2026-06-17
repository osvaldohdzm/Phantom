"""Repara acentos y mojibake en hallazgos al leer o servir por API."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.core import Finding
from app.services.finding_catalog_sync import apply_operational_catalog_to_finding
from app.services.text_encoding import fix_optional_str
from app.services.vulns_catalog_lookup import resolve_operational_catalog_for_finding

_TEXT_FIELDS = (
    "titulo",
    "descripcion",
    "explicacion_tecnica",
    "amenaza_ampliada",
    "componente_afectado",
    "metodo_deteccion",
    "propuesta_remediacion",
    "referencias",
    "raw_tool_output",
)


def _repair_field(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    fixed = fix_optional_str(value)
    return fixed if fixed is not None else value


def _apply_operational_catalog_overlay(db: Session, finding: Finding) -> None:
    """Catálogo operativo (Esp*) prevalece sobre copia en hallazgo — solo en memoria si no hay commit."""
    cat = resolve_operational_catalog_for_finding(db, finding)
    if cat:
        apply_operational_catalog_to_finding(finding, cat, force=True)


def repair_finding_text(finding: Finding, db: Optional[Session] = None) -> Finding:
    """Aplica reparación de encoding y, si hay catálogo, título unificado en español."""
    for field in _TEXT_FIELDS:
        setattr(finding, field, _repair_field(getattr(finding, field, None)))
    if db is not None:
        _apply_operational_catalog_overlay(db, finding)
        for field in _TEXT_FIELDS:
            setattr(finding, field, _repair_field(getattr(finding, field, None)))
    return finding


def repair_findings_text(findings: list[Finding], db: Optional[Session] = None) -> list[Finding]:
    for f in findings:
        repair_finding_text(f, db)
    return findings


def repair_and_persist_findings(db: Session, findings: list[Finding]) -> int:
    """Repara encoding y catálogo; guarda en BD. Devuelve cuántos cambiaron."""
    changed = 0
    for f in findings:
        before = {field: getattr(f, field) for field in _TEXT_FIELDS}
        repair_finding_text(f, db)
        after = {field: getattr(f, field) for field in _TEXT_FIELDS}
        if before != after:
            changed += 1
    if changed:
        db.commit()
    return changed
