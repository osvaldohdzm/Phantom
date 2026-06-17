import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Enum, String, Text
from app.models.db_types import PortableUUID, PortableJSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class MITRETactic(str, enum.Enum):
    reconnaissance = "Reconnaissance"
    resource_development = "Resource Development"
    initial_access = "Initial Access"
    execution = "Execution"
    persistence = "Persistence"
    privilege_escalation = "Privilege Escalation"
    defense_evasion = "Defense Evasion"
    credential_access = "Credential Access"
    discovery = "Discovery"
    lateral_movement = "Lateral Movement"
    collection = "Collection"
    command_and_control = "Command and Control"
    exfiltration = "Exfiltration"
    impact = "Impact"

class TTPEntry(Base):
    __tablename__ = "ttp_catalog"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tactic: Mapped[MITRETactic] = mapped_column(Enum(MITRETactic), nullable=False)
    tool: Mapped[str] = mapped_column(String(100), nullable=False)
    command_template: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(nullable=False, default=1)
    tags: Mapped[list[str]] = mapped_column(PortableJSON, nullable=False)  # JSON list of tags
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
