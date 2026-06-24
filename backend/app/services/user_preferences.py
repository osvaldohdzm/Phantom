"""Preferencias de usuario (idioma de interfaz, etc.)."""

from __future__ import annotations

from typing import Any, Literal, Optional

UiLanguagePreference = Literal["auto", "es", "en"]
TenantLanguage = Literal["es", "en"]

DEFAULT_USER_PREFERENCES: dict[str, Any] = {"ui_language": "auto"}


def normalize_user_preferences(raw: Optional[dict]) -> dict[str, Any]:
    out = dict(DEFAULT_USER_PREFERENCES)
    if not raw or not isinstance(raw, dict):
        return out
    pref = str(raw.get("ui_language") or "auto").strip().lower()
    if pref in ("auto", "es", "en"):
        out["ui_language"] = pref
    return out


def ui_language_preference(raw: Optional[dict]) -> UiLanguagePreference:
    pref = normalize_user_preferences(raw)["ui_language"]
    return pref if pref in ("auto", "es", "en") else "auto"


def resolve_ui_language(
    preferences: Optional[dict],
    tenant_language: TenantLanguage,
) -> TenantLanguage:
    pref = ui_language_preference(preferences)
    if pref in ("es", "en"):
        return pref
    return tenant_language
