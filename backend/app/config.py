from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:299792458.Light@localhost:5432/katana_security_db"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None


settings = Settings()
