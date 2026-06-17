"""Lectura y plantillas de configuración de base de datos (sin modificar la conexión activa)."""

from __future__ import annotations

import re
from typing import Any, Literal, Optional
from urllib.parse import quote, unquote, urlparse

from app.config import settings

DatabaseMode = Literal["postgresql", "sqlite", "other"]
DeploymentProfileId = Literal["postgresql", "embedded_sqlite", "docker_postgres"]


def _mask_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if len(value) <= 2:
        return "••••"
    return f"{value[0]}••••{value[-1]}"


def parse_database_url(url: str) -> dict[str, Any]:
    parsed = urlparse(url)
    driver = (parsed.scheme or "").lower()
    if driver.startswith("postgresql"):
        mode: DatabaseMode = "postgresql"
    elif driver.startswith("sqlite"):
        mode = "sqlite"
    else:
        mode = "other"

    database = unquote(parsed.path.lstrip("/")) if parsed.path else None
    if mode == "sqlite" and database:
        database = parsed.path  # ruta relativa/absoluta del archivo

    return {
        "mode": mode,
        "driver": driver or None,
        "username": unquote(parsed.username) if parsed.username else None,
        "password_masked": _mask_secret(unquote(parsed.password) if parsed.password else None),
        "host": parsed.hostname,
        "port": parsed.port,
        "database": database,
        "query": parsed.query or None,
        "url_masked": mask_database_url(url),
    }


def mask_database_url(url: str) -> str:
    """Oculta contraseña en la URL para mostrar en UI."""
    parsed = urlparse(url)
    if not parsed.password:
        return url
    raw_password = parsed.password
    return url.replace(f":{raw_password}@", ":••••••@")


def runtime_database_info() -> dict[str, Any]:
    parsed = parse_database_url(settings.database_url)
    redis_parsed = urlparse(settings.redis_url)
    return {
        "active": True,
        "read_only": True,
        "mode": parsed["mode"],
        "driver": parsed["driver"],
        "connection_name": "DATABASE_URL",
        "database_url_masked": parsed["url_masked"],
        "host": parsed["host"],
        "port": parsed["port"],
        "database": parsed["database"],
        "username": parsed["username"],
        "password_masked": parsed["password_masked"],
        "query": parsed["query"],
        "redis_url_masked": mask_redis_url(settings.redis_url),
        "redis_host": redis_parsed.hostname,
        "redis_port": redis_parsed.port or 6379,
        "redis_db": redis_parsed.path.lstrip("/") or "0",
        "auth_required": settings.auth_required,
        "jwt_expire_minutes": settings.jwt_expire_minutes,
        "can_switch_from_ui": False,
        "switch_note": (
            "La conexión activa se define en backend/.env antes de arrancar. "
            "Esta pantalla no modifica tu instancia en ejecución."
        ),
    }


def mask_redis_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.password:
        return url.replace(parsed.password, "••••••")
    return url


def deployment_profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": "postgresql",
            "label": "PostgreSQL (producción / robusto)",
            "description": (
                "Recomendado para equipos y datos compartidos. Requiere servidor PostgreSQL "
                "(local, Docker o gestionado)."
            ),
            "recommended_for": ["Producción", "Multi-usuario", "Grandes volúmenes"],
            "env_file_name": ".env.postgres.example",
            "database_mode": "postgresql",
        },
        {
            "id": "docker_postgres",
            "label": "PostgreSQL en Docker (instalación rápida)",
            "description": (
                "Levanta PostgreSQL con docker compose sin instalarlo en el sistema. "
                "Ideal para otro equipo que descarga el proyecto."
            ),
            "recommended_for": ["Demo", "Laboratorio", "Sin configurar Postgres manualmente"],
            "env_file_name": ".env.docker-postgres.example",
            "database_mode": "postgresql",
        },
        {
            "id": "embedded_sqlite",
            "label": "SQLite embebido (descargar y usar)",
            "description": (
                "Archivo local sin servidor de base de datos. Cero configuración de Postgres; "
                "adecuado para pruebas personales o un solo analista en un equipo nuevo."
            ),
            "recommended_for": ["Evaluación", "Portátil", "Sin infraestructura"],
            "env_file_name": ".env.embedded.example",
            "database_mode": "sqlite",
            "limitations": [
                "Catálogo CFR (core.vulns_catalog) requiere PostgreSQL",
                "Usar solo en instalaciones nuevas (archivo .db vacío)",
                "No sustituye PostgreSQL en producción multi-equipo",
            ],
        },
    ]


def build_env_template(profile_id: DeploymentProfileId) -> str:
    if profile_id == "embedded_sqlite":
        return "\n".join(
            [
                "# Phantom — instalación nueva con SQLite embebido",
                "# Copia a backend/.env en un equipo SIN base de datos existente.",
                "",
                "DATABASE_URL=sqlite:///./data/spectre.db",
                "REDIS_URL=redis://localhost:6379/0",
                "AUTH_REQUIRED=true",
                "JWT_SECRET=cambia-este-secreto-en-produccion",
                "JWT_EXPIRE_MINUTES=480",
                "VAULT_MASTER_KEY=ZEdWd2FXNW5kR2x2Ym5NdlpHVjJZVzFoWlhNd2RHOXNadz09",
                "",
            ]
        )
    if profile_id == "docker_postgres":
        return "\n".join(
            [
                "# Phantom — PostgreSQL vía Docker (docker compose up -d db)",
                "# Copia a backend/.env en instalación nueva.",
                "",
                "DATABASE_URL=postgresql+psycopg2://postgres:postgresql@127.0.0.1:5432/katana_security_db",
                "REDIS_URL=redis://localhost:6379/0",
                "AUTH_REQUIRED=true",
                "JWT_SECRET=cambia-este-secreto-en-produccion",
                "JWT_EXPIRE_MINUTES=480",
                "VAULT_MASTER_KEY=ZEdWd2FXNW5kR2x2Ym5NdlpHVjJZVzFoWlhNd2RHOXNadz09",
                "",
                "POSTGRES_HOST=127.0.0.1",
                "POSTGRES_PORT=5432",
                "POSTGRES_DB=katana_security_db",
                "POSTGRES_USER=postgres",
                "POSTGRES_PASSWORD=postgresql",
                "",
            ]
        )
    # postgresql default
    user = quote("postgres")
    password = quote("postgresql")
    return "\n".join(
        [
            "# Phantom — PostgreSQL (servidor propio)",
            "# Copia a backend/.env en instalación nueva.",
            "",
            f"DATABASE_URL=postgresql+psycopg2://{user}:{password}@127.0.0.1:5432/katana_security_db",
            "REDIS_URL=redis://localhost:6379/0",
            "AUTH_REQUIRED=true",
            "JWT_SECRET=cambia-este-secreto-en-produccion",
            "JWT_EXPIRE_MINUTES=480",
            "VAULT_MASTER_KEY=ZEdWd2FXNW5kR2x2Ym5NdlpHVjJZVzFoWlhNd2RHOXNadz09",
            "",
            "POSTGRES_HOST=127.0.0.1",
            "POSTGRES_PORT=5432",
            "POSTGRES_DB=katana_security_db",
            "POSTGRES_USER=postgres",
            "POSTGRES_PASSWORD=postgresql",
            "",
        ]
    )
