"""Tipos SQLAlchemy compatibles con PostgreSQL y SQLite embebido."""

from sqlalchemy import JSON, Uuid
from sqlalchemy.dialects.postgresql import JSONB

PortableUUID = Uuid(as_uuid=True)
PortableJSON = JSON().with_variant(JSONB(), "postgresql")
