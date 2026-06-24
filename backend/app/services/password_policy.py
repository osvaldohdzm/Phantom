"""Política de contraseñas robusta para cuentas Phantom."""

from __future__ import annotations

import re

from app.services.auth_seed import DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD

_MIN_LENGTH = 12
_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")
_UPPER_RE = re.compile(r"[A-Z]")
_LOWER_RE = re.compile(r"[a-z]")
_DIGIT_RE = re.compile(r"[0-9]")

_COMMON_WEAK = frozenset(
    {
        "phantom",
        "password",
        "password123",
        "12345678",
        "123456789",
        "admin",
        "administrator",
        "changeme",
        "qwerty",
        "letmein",
    }
)


def validate_password_strength(password: str, *, login: str | None = None) -> list[str]:
    """Devuelve lista de errores (vacía si la contraseña cumple la política)."""
    errors: list[str] = []
    pwd = password or ""
    normalized = pwd.strip().lower()

    if len(pwd) < _MIN_LENGTH:
        errors.append(f"Mínimo {_MIN_LENGTH} caracteres")
    if not _UPPER_RE.search(pwd):
        errors.append("Al menos una letra mayúscula")
    if not _LOWER_RE.search(pwd):
        errors.append("Al menos una letra minúscula")
    if not _DIGIT_RE.search(pwd):
        errors.append("Al menos un número")
    if not _SPECIAL_RE.search(pwd):
        errors.append("Al menos un carácter especial (!@#$%…)")
    if normalized in _COMMON_WEAK:
        errors.append("Contraseña demasiado común o predecible")
    if normalized == DEFAULT_ADMIN_PASSWORD.lower():
        errors.append("No puedes reutilizar la contraseña por defecto del sistema")
    if login and normalized == login.strip().lower():
        errors.append("La contraseña no puede ser igual al usuario")
    if login and login.strip().lower() in normalized and len(normalized) < _MIN_LENGTH + 4:
        errors.append("La contraseña no debe contener solo el nombre de usuario")

    return errors


def password_policy_hint() -> str:
    return (
        f"Mínimo {_MIN_LENGTH} caracteres, mayúscula, minúscula, número y carácter especial. "
        "No uses «phantom» ni contraseñas obvias."
    )


def is_default_seed_password(login: str, password: str) -> bool:
    return login.strip().lower() == DEFAULT_ADMIN_LOGIN and password == DEFAULT_ADMIN_PASSWORD
