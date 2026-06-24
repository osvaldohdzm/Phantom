"""Idioma operativo del tenant y mapeo de columnas del catálogo por locale."""

from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth import Tenant
from app.services.tenant_branding import normalize_branding

TenantLanguage = Literal["es", "en"]

DEFAULT_TENANT_LANGUAGE: TenantLanguage = "es"

LOCALE_COLUMNS: dict[TenantLanguage, dict[str, str]] = {
    "es": {
        "title": "EspNombreVulnerabilidadUnificado",
        "severity": "EspSeveridadUnificada",
        "description": "EspDescripcionUnificada",
        "threat_general": "EspAmenazaUnificadaGeneral",
        "threat_internet": "EspAmenazaUnificadaDesdeInternet",
        "remediation": "EspPropuestaRemediacionUnificada",
        "remediation_private": "EspPropuestaRemediacionUnificadaEnRedPrivada",
        "detection_method": "EspMetodoDeteccion",
        "technical_explanation": "EspExplicacionTecnica",
    },
    "en": {
        "title": "StandardVulnerabilityName",
        "severity": "Severity",
        "description": "Description",
        "threat_general": "Danger",
        "threat_internet": "Danger",
        "remediation": "Solution",
        "remediation_private": "Solution",
        "detection_method": "SourceDetection",
        "technical_explanation": "Description",
    },
}

LOCALE_TITLE_FALLBACK: dict[TenantLanguage, str] = {
    "es": "StandardVulnerabilityName",
    "en": "Vulnerability",
}


def resolve_tenant_language(branding: Optional[dict[str, Any]]) -> TenantLanguage:
    normalized = normalize_branding(branding)
    raw = str(normalized.get("language") or "").strip().lower()
    return "en" if raw == "en" else "es"


def tenant_language_for_id(db: Session, tenant_id: UUID) -> TenantLanguage:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        return DEFAULT_TENANT_LANGUAGE
    return resolve_tenant_language(tenant.branding)


def catalog_column(language: TenantLanguage, key: str) -> str:
    return LOCALE_COLUMNS[language][key]


def catalog_title_columns(language: TenantLanguage) -> tuple[str, str]:
    return (
        catalog_column(language, "title"),
        LOCALE_TITLE_FALLBACK[language],
    )


def catalog_field_map(language: TenantLanguage) -> tuple[tuple[str, str, int], ...]:
    """(finding_attr, catalog_column, max_len)"""
    return (
        ("descripcion", catalog_column(language, "description"), 32000),
        ("amenaza_ampliada", catalog_column(language, "threat_general"), 32000),
        ("metodo_deteccion", catalog_column(language, "detection_method"), 32000),
        ("explicacion_tecnica", catalog_column(language, "technical_explanation"), 32000),
        ("referencias", "References", 32000),
    )


def catalog_remediation_columns(language: TenantLanguage) -> tuple[str, str]:
    return (
        catalog_column(language, "remediation_private"),
        catalog_column(language, "remediation"),
    )
