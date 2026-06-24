"""White-label / tenant branding: normalización, defaults y URLs de assets."""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Optional
from uuid import UUID

from app.services.official_field_config import merge_official_fields, normalize_official_fields

HEX_COLOR = re.compile(r"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$")

BRANDING_DEFAULTS: dict[str, Any] = {
    "language": "es",
    "product_name": "Phantom",
    "workspace_name": None,
    "tagline": "Security Operations Platform",
    "login_headline": "Sign in",
    "login_subtitle": None,
    "login_message": None,
    "logo_url": None,
    "logo_dark_url": None,
    "logo_secondary_url": None,
    "favicon_url": None,
    "login_banner_url": None,
    "dashboard_banner_url": None,
    "primary_color": None,
    "accent_color": None,
    "sidebar_color": None,
    "default_theme": "system",
    "allow_theme_toggle": True,
    "custom_domain": None,
    "custom_domain_verified": False,
    "report_company_name": None,
    "report_footer": None,
    "report_watermark": None,
    "report_classification": "CONFIDENCIAL",
    "email_from_name": None,
    "email_footer_html": None,
}

BRANDING_ASSET_SLOTS = frozenset(
    {
        "logo",
        "logo_dark",
        "logo_secondary",
        "favicon",
        "login_banner",
        "dashboard_banner",
    }
)

SLOT_TO_URL_KEY = {
    "logo": "logo_url",
    "logo_dark": "logo_dark_url",
    "logo_secondary": "logo_secondary_url",
    "favicon": "favicon_url",
    "login_banner": "login_banner_url",
    "dashboard_banner": "dashboard_banner_url",
}

ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"}


def _clean_str(value: Any, *, max_len: int = 500) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:max_len]


def _clean_hex(value: Any) -> Optional[str]:
    text = _clean_str(value, max_len=7)
    if not text:
        return None
    if not text.startswith("#"):
        text = f"#{text}"
    return text if HEX_COLOR.match(text) else None


def normalize_branding(raw: Optional[dict]) -> dict[str, Any]:
    """Fusiona JSON almacenado con defaults y sanea valores."""
    base = deepcopy(BRANDING_DEFAULTS)
    if not raw or not isinstance(raw, dict):
        return base

    for key in BRANDING_DEFAULTS:
        if key not in raw:
            continue
        val = raw[key]
        if key in ("primary_color", "accent_color", "sidebar_color"):
            base[key] = _clean_hex(val)
        elif key == "language":
            if val in ("es", "en"):
                base[key] = val
        elif key == "default_theme":
            if val in ("light", "dark", "system"):
                base[key] = val
        elif key == "allow_theme_toggle":
            base[key] = bool(val)
        elif key == "custom_domain_verified":
            base[key] = bool(val)
        elif key in (
            "logo_url",
            "logo_dark_url",
            "logo_secondary_url",
            "favicon_url",
            "login_banner_url",
            "dashboard_banner_url",
        ):
            base[key] = _clean_str(val, max_len=2048)
        elif key == "email_footer_html":
            base[key] = _clean_str(val, max_len=8000)
        else:
            base[key] = _clean_str(val, max_len=255 if key != "report_footer" else 2000)

    base["official_fields"] = normalize_official_fields(raw.get("official_fields"))
    return base


def merge_branding_update(current: Optional[dict], patch: dict[str, Any]) -> dict[str, Any]:
    merged = normalize_branding(current)
    for key, val in patch.items():
        if key not in BRANDING_DEFAULTS:
            continue
        if val is None:
            merged[key] = BRANDING_DEFAULTS[key]
        elif key in ("primary_color", "accent_color", "sidebar_color"):
            merged[key] = _clean_hex(val)
        elif key == "language" and val in ("es", "en"):
            merged[key] = val
        elif key == "default_theme" and val in ("light", "dark", "system"):
            merged[key] = val
        elif key == "allow_theme_toggle":
            merged[key] = bool(val)
        elif key == "custom_domain_verified":
            merged[key] = bool(val)
        else:
            merged[key] = _clean_str(val, max_len=8000 if key == "email_footer_html" else 255)
    if "official_fields" in patch:
        merged["official_fields"] = merge_official_fields(
            merged.get("official_fields"), patch["official_fields"]
        )
    return merged


def branding_asset_url(tenant_id: UUID, filename: str) -> str:
    return f"/api/v1/branding/assets/{tenant_id}/{filename}"


def display_name(branding: dict[str, Any], tenant_nombre: str) -> str:
    return branding.get("workspace_name") or tenant_nombre


def product_label(branding: dict[str, Any]) -> str:
    return branding.get("product_name") or BRANDING_DEFAULTS["product_name"]
