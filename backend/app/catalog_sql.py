"""Nombres de tablas del esquema catálogo (PostgreSQL: core.*, SQLite: core_*)."""

from __future__ import annotations

from app.config import settings


def catalog_table(name: str) -> str:
    if settings.is_sqlite:
        return f"core_{name}"
    return f"core.{name}"


def vulnerability_catalog_tablename() -> str:
    return "core_vulnerabilities" if settings.is_sqlite else "vulnerabilities"


def vulnerability_catalog_table_args() -> tuple | dict:
    if settings.is_sqlite:
        return ()
    return {"schema": "core"}


def vulnerability_catalog_fk() -> str:
    if settings.is_sqlite:
        return "core_vulnerabilities.Id"
    return "core.vulnerabilities.Id"
