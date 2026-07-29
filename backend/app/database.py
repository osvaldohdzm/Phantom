from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker, DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


from pathlib import Path

import os
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Resolve SQLite database file name dynamically
db_name = os.getenv("DB_NAME", "phantom_local")
if not db_name.endswith(".db"):
    db_name = f"{db_name}.db"

LOCAL_SQLITE_PATH = BACKEND_DIR / db_name


def _create_engine():
    url = settings.database_url
    if not settings.is_sqlite and ("localhost" in url or "127.0.0.1" in url):
        import socket
        try:
            s = socket.create_connection(("127.0.0.1", 5432), timeout=0.8)
            s.close()
        except Exception:
            # Automatic fallback to local SQLite when PostgreSQL port 5432 is offline
            url = f"sqlite:///{LOCAL_SQLITE_PATH}"
            settings.database_url = url

    if url.startswith("sqlite") and "./" in url:
        url = f"sqlite:///{LOCAL_SQLITE_PATH}"
        settings.database_url = url

    if url.startswith("sqlite"):
        eng = create_engine(
            url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )

        @event.listens_for(eng, "connect")
        def _sqlite_pragma(dbapi_connection, connection_record):  # noqa: ARG001
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return eng
    return create_engine(url, pool_pre_ping=True)


engine = _create_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
