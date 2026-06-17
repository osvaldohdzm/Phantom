import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from app.models.db_types import PortableUUID, PortableJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class SnapshotType(str, enum.Enum):
    initial_discovery = "initial_discovery"
    validated = "validated"
    final = "final"

class ScopeSnapshot(Base):
    __tablename__ = "scope_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("engagements.id"), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False, default=1)
    snapshot_type: Mapped[SnapshotType] = mapped_column(Enum(SnapshotType), nullable=False)
    asset_ids: Mapped[list[str]] = mapped_column(PortableJSON, nullable=False)  # list of asset UUIDs as strings
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    engagement: Mapped["Engagement"] = relationship("Engagement")
