from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/katana_security_db"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    vault_master_key: str = "ZEdWd2FXNW5kR2x2Ym5NdlpHVjJZVzFoWlhNd2RHOXNadz09"
    jwt_secret: str = "Phantom-dev-jwt-change-in-production"
    jwt_expire_minutes: int = 480
    auth_required: bool = True

    # Hybrid parser stack (Go platform ingest + Rust fast paths)
    ingest_go_url: Optional[str] = None
    parse_rust_url: Optional[str] = None

    # Async ingest via Redis worker
    ingest_async_enabled: bool = True
    ingest_async_min_rows: int = 5000
    ingest_async_min_bytes: int = 5 * 1024 * 1024
    ingest_worker_enabled: bool = True

    @property
    def database_mode(self) -> Literal["postgresql", "sqlite", "other"]:
        url = (self.database_url or "").lower()
        if url.startswith("sqlite"):
            return "sqlite"
        if url.startswith("postgresql") or url.startswith("postgres"):
            return "postgresql"
        return "other"

    @property
    def is_sqlite(self) -> bool:
        return self.database_mode == "sqlite"


settings = Settings()
