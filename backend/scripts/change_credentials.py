"""Cambia contraseña del administrador principal (interactivo)."""

from __future__ import annotations

import argparse
import getpass
import sys
import termios

from sqlalchemy import or_

from app.database import SessionLocal
from app.models.auth import TenantMembership, User, UserRole
from app.services.auth_seed import (
    DEFAULT_ADMIN_LOGIN,
    LEGACY_ADMIN_LOGINS,
    migrate_legacy_admin_login,
)
from app.services.password_policy import validate_password_strength
from app.services.passwords import hash_password


def _find_admin_user(db) -> User | None:
    phantom = db.query(User).filter(User.email == DEFAULT_ADMIN_LOGIN).first()
    if phantom:
        return phantom

    row = (
        db.query(User)
        .join(TenantMembership, TenantMembership.user_id == User.id)
        .filter(TenantMembership.role == UserRole.platform_admin)
        .order_by(User.created_at)
        .first()
    )
    if row:
        return row

    return (
        db.query(User)
        .filter(or_(*[User.email == login for login in LEGACY_ADMIN_LOGINS]))
        .order_by(User.created_at)
        .first()
    )


def _read_secret(prompt: str) -> str:
    """Lee sin mostrar caracteres (como passwd en Linux)."""
    try:
        with open("/dev/tty", "rb") as tty_in, open("/dev/tty", "wb") as tty_out:
            tty_out.write(prompt.encode("utf-8"))
            tty_out.flush()
            attrs = termios.tcgetattr(tty_in.fileno())
            try:
                no_echo = termios.tcgetattr(tty_in.fileno())
                no_echo[3] &= ~termios.ECHO
                termios.tcsetattr(tty_in.fileno(), termios.TCSADRAIN, no_echo)
                data = tty_in.readline()
            finally:
                termios.tcsetattr(tty_in.fileno(), termios.TCSADRAIN, attrs)
            tty_out.write(b"\n")
            tty_out.flush()
        return data.decode("utf-8", errors="replace").rstrip("\n\r")
    except OSError:
        return getpass.getpass(prompt)


def _prompt_password(login: str) -> str:
    while True:
        pwd = _read_secret("Nueva contraseña: ")
        errors = validate_password_strength(pwd, login=login)
        if errors:
            print("[!] " + "; ".join(errors))
            continue
        confirm = _read_secret("Confirmar contraseña: ")
        if pwd != confirm:
            print("[!] Las contraseñas no coinciden. Intenta de nuevo.")
            continue
        return pwd


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cambia credenciales del administrador Phantom.")
    parser.add_argument(
        "--rename-user",
        metavar="LOGIN",
        help="Cambia también el usuario de acceso (por defecto solo se cambia la contraseña).",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    db = SessionLocal()
    try:
        migrated = migrate_legacy_admin_login(db)
        if migrated:
            db.commit()

        user = _find_admin_user(db)
        if not user:
            print("[!] No se encontró un usuario administrador en la base de datos.")
            return 1

        print("============================================================")
        print(" Phantom — cambio de credenciales del administrador")
        print("============================================================")
        print(f"Usuario: {user.email}")
        if user.nombre:
            print(f"Nombre:  {user.nombre}")
        print()
        print("Solo se cambiará la contraseña (la entrada no se muestra en pantalla).")

        new_login = (args.rename_user or "").strip().lower() or user.email
        if args.rename_user:
            if len(new_login) < 2:
                print("[!] El usuario debe tener al menos 2 caracteres.")
                return 1
            if " " in new_login:
                print("[!] El usuario no puede contener espacios.")
                return 1

        new_password = _prompt_password(new_login)

        if new_login != user.email:
            taken = db.query(User).filter(User.email == new_login, User.id != user.id).first()
            if taken:
                print(f"[!] El usuario «{new_login}» ya existe.")
                return 1
            user.email = new_login

        user.password_hash = hash_password(new_password)
        user.must_change_password = False
        user.is_active = True
        db.commit()

        print()
        print(f"[+] Contraseña actualizada para el usuario «{user.email}».")
        print("[*] El cambio es persistente: no se revierte al reiniciar ./start-dev.sh")
        return 0
    except KeyboardInterrupt:
        print("\n[!] Cancelado.")
        return 130
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
