import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, LargeBinary, Integer
from app.models.db_types import PortableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class CredentialType(str, enum.Enum):
    ssh = "ssh"
    rdp = "rdp"
    web = "web"
    database = "database"
    api_key = "api_key"
    certificate = "certificate"

class VaultCredential(Base):
    __tablename__ = "vault_credentials"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(PortableUUID, ForeignKey("engagements.id"), nullable=True)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(PortableUUID, ForeignKey("assets.id"), nullable=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_type: Mapped[CredentialType] = mapped_column(Enum(CredentialType), nullable=False)
    
    # AES-256 encrypted values
    username_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    secret_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    service_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes_encrypted: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    asset: Mapped[Optional["Asset"]] = relationship("Asset", back_populates="vault_credentials")
    engagement: Mapped[Optional["Engagement"]] = relationship("Engagement")
    audit_logs: Mapped[list["VaultAuditLog"]] = relationship("VaultAuditLog", back_populates="credential", cascade="all, delete-orphan")

class VaultAuditAction(str, enum.Enum):
    created = "created"
    read = "read"
    updated = "updated"
    deleted = "deleted"
    used = "used"

class VaultAuditLog(Base):
    __tablename__ = "vault_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    credential_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("vault_credentials.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[VaultAuditAction] = mapped_column(Enum(VaultAuditAction), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    credential: Mapped["VaultCredential"] = relationship("VaultCredential", back_populates="audit_logs")
