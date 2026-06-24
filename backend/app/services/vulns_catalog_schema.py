"""Esquema operativo de core.vulns_catalog (columnas presentes en la BD importada)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

DESIRED_CATALOG_LOOKUP_COLUMNS: tuple[str, ...] = (
    "Id",
    "EspNombreVulnerabilidadUnificado",
    "EspSeveridadUnificada",
    "EspDescripcionUnificada",
    "EspAmenazaUnificadaGeneral",
    "EspAmenazaUnificadaDesdeInternet",
    "EspPropuestaRemediacionUnificadaEnRedPrivada",
    "EspPropuestaRemediacionUnificada",
    "EspMetodoDeteccion",
    "EspExplicacionTecnica",
    "References",
    "CVE",
    "CWE",
    "CVSSOverallScore3_1",
    "CVSSVector3_1",
    "StandardVulnerabilityName",
    "NessusPluginId",
    "SourceDetection",
    "Description",
    "Danger",
    "Solution",
    "Severity",
    "Vulnerability",
)

_TABLE_COLUMNS_CACHE: Optional[set[str]] = None
_SELECT_CLAUSE_CACHE: Optional[str] = None


def invalidate_vulns_catalog_schema_cache() -> None:
    global _TABLE_COLUMNS_CACHE, _SELECT_CLAUSE_CACHE
    _TABLE_COLUMNS_CACHE = None
    _SELECT_CLAUSE_CACHE = None


def vulns_catalog_table_columns(db: Session) -> set[str]:
    global _TABLE_COLUMNS_CACHE
    if _TABLE_COLUMNS_CACHE is not None:
        return _TABLE_COLUMNS_CACHE
    try:
        rows = db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
                """
            )
        ).mappings().all()
        _TABLE_COLUMNS_CACHE = {str(r["column_name"]) for r in rows}
    except Exception:
        rollback_db_on_error(db)
        return set()
    return _TABLE_COLUMNS_CACHE


def catalog_column_available(db: Session, column: str) -> bool:
    return column in vulns_catalog_table_columns(db)


def vulns_catalog_lookup_select_clause(db: Session) -> str:
    global _SELECT_CLAUSE_CACHE
    if _SELECT_CLAUSE_CACHE is not None:
        return _SELECT_CLAUSE_CACHE
    cols = vulns_catalog_table_columns(db)
    if not cols:
        _SELECT_CLAUSE_CACHE = '"Id", "NessusPluginId"'
        return _SELECT_CLAUSE_CACHE
    picked = [c for c in DESIRED_CATALOG_LOOKUP_COLUMNS if c in cols]
    if "Id" not in picked:
        picked.insert(0, "Id")
    _SELECT_CLAUSE_CACHE = ", ".join(f'"{c}"' for c in picked)
    return _SELECT_CLAUSE_CACHE


def rollback_db_on_error(db: Session) -> None:
    """PostgreSQL aborta la transacción tras un error SQL; hay que hacer rollback."""
    try:
        db.rollback()
    except Exception:
        pass
