import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, String, Text, Integer
from app.models.db_types import PortableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("engagements.id"), nullable=False)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(PortableUUID, ForeignKey("assets.id"), nullable=True)
    node_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    command: Mapped[str] = mapped_column(Text, nullable=False)
    raw_output: Mapped[str] = mapped_column(Text, nullable=False)
    output_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    executed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_log_id: Mapped[Optional[uuid.UUID]] = mapped_column(PortableUUID, ForeignKey("execution_logs.id"), nullable=True)

    engagement: Mapped["Engagement"] = relationship("Engagement")
    asset: Mapped[Optional["Asset"]] = relationship("Asset")
