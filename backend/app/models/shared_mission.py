import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.db_types import PortableJSON, PortableUUID

if TYPE_CHECKING:
    from app.models.core import Engagement


class SharedMission(Base):
    __tablename__ = "shared_missions"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    share_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    access_code: Mapped[str] = mapped_column(String(16), nullable=False)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        PortableUUID, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False
    )
    snapshot: Mapped[dict] = mapped_column(PortableJSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    engagement: Mapped["Engagement"] = relationship("Engagement")
