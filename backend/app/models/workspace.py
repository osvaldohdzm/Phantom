import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from app.models.db_types import PortableUUID, PortableJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PhantomWorkspace(Base):
    """Workspace de pentest (grafo Phantom / Kronos Engine) persistido en servidor."""

    __tablename__ = "phantom_workspaces"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("engagements.id"), nullable=True
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("assets.id"), nullable=True
    )
    global_vars: Mapped[dict] = mapped_column(PortableJSON, nullable=False, default=dict)
    nodes: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    connections: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    custom_rules: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="admin")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    engagement: Mapped[Optional["Engagement"]] = relationship("Engagement")
    asset: Mapped[Optional["Asset"]] = relationship("Asset")
