"""Campos oficiales del catálogo por idioma operativo del tenant (branding.official_fields)."""

from __future__ import annotations

from typing import Any, Literal, Optional

TenantLanguage = Literal["es", "en"]
DEFAULT_TENANT_LANGUAGE: TenantLanguage = "es"

OFFICIAL_FIELD_LOCALES: tuple[TenantLanguage, ...] = ("es", "en")


def _clean_str_list(value: Any, *, max_items: int = 64) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if text and text not in out:
            out.append(text[:128])
        if len(out) >= max_items:
            break
    return out


def normalize_official_field_config(
    raw: Any,
    language: TenantLanguage = DEFAULT_TENANT_LANGUAGE,
) -> Optional[dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    mandatory = _clean_str_list(raw.get("mandatoryCatalogColumns"))
    finding_fields = _clean_str_list(raw.get("mandatoryFindingFields"))
    display = _clean_str_list(raw.get("displayColumns"))
    min_catalog = raw.get("minLengthsCatalog") if isinstance(raw.get("minLengthsCatalog"), dict) else {}
    min_finding = raw.get("minLengthsFinding") if isinstance(raw.get("minLengthsFinding"), dict) else {}
    ai_prompts = raw.get("aiPrompts") if isinstance(raw.get("aiPrompts"), dict) else {}
    return {
        "v": 1,
        "mandatoryCatalogColumns": mandatory,
        "mandatoryFindingFields": finding_fields,
        "displayColumns": display,
        "minLengthsCatalog": min_catalog,
        "minLengthsFinding": min_finding,
        "aiPrompts": {str(k): str(v)[:8000] for k, v in ai_prompts.items() if str(v).strip()},
        "_locale": language,
    }


def normalize_official_fields(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    for lang in OFFICIAL_FIELD_LOCALES:
        if lang not in raw:
            continue
        cfg = normalize_official_field_config(raw[lang], language=lang)
        if cfg:
            out[lang] = cfg
    return out


def merge_official_fields(
    current: Optional[dict],
    patch: Any,
) -> dict[str, Any]:
    base = normalize_official_fields(current or {})
    if not isinstance(patch, dict):
        return base
    for lang in OFFICIAL_FIELD_LOCALES:
        if lang not in patch:
            continue
        cfg = normalize_official_field_config(patch[lang], language=lang)
        if cfg:
            base[lang] = cfg
        elif lang in base:
            del base[lang]
    return base


def official_field_config_for_language(
    branding: Optional[dict],
    language: TenantLanguage = DEFAULT_TENANT_LANGUAGE,
) -> Optional[dict[str, Any]]:
    fields = normalize_official_fields((branding or {}).get("official_fields"))
    return fields.get(language)
