"""Preferencias de usuario (idioma de interfaz, etc.)."""

from __future__ import annotations

from typing import Any, Literal, Optional

UiLanguagePreference = Literal["auto", "es", "en"]
TenantLanguage = Literal["es", "en"]

DEFAULT_USER_PREFERENCES: dict[str, Any] = {
    "ui_language": "auto",
    "initial_setup_complete": False,
}


def normalize_user_preferences(raw: Optional[dict]) -> dict[str, Any]:
    out = dict(DEFAULT_USER_PREFERENCES)
    if not raw or not isinstance(raw, dict):
        return out
    pref = str(raw.get("ui_language") or "auto").strip().lower()
    if pref in ("auto", "es", "en"):
        out["ui_language"] = pref
    if "initial_setup_complete" in raw:
        out["initial_setup_complete"] = bool(raw.get("initial_setup_complete"))
    return out


def is_initial_setup_complete(raw: Optional[dict]) -> bool:
    return bool(normalize_user_preferences(raw).get("initial_setup_complete"))


def backfill_initial_setup_complete(db) -> None:
    """Instalaciones existentes: marcar setup hecho si ya no usan contraseña semilla."""
    from app.models.auth import User

    changed = 0
    for user in db.query(User).all():
        raw = user.preferences if isinstance(user.preferences, dict) else {}
        if "initial_setup_complete" in raw:
            continue
        prefs = normalize_user_preferences(raw)
        if not user.must_change_password:
            prefs["initial_setup_complete"] = True
        user.preferences = prefs
        changed += 1
    if changed:
        db.commit()


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
