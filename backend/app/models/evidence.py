import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from app.models.db_types import PortableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class AttachmentType(str, enum.Enum):
    screenshot = "screenshot"
    console_log = "console_log"
    pcap = "pcap"
    request_response = "request_response"
    file = "file"

class EvidenceAttachment(Base):
    __tablename__ = "evidence_attachments"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("findings.id", ondelete="CASCADE"), nullable=False)
    attachment_type: Mapped[AttachmentType] = mapped_column(Enum(AttachmentType), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)  # Ruta local de almacenamiento
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False, default="admin")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    finding: Mapped["Finding"] = relationship("Finding", back_populates="evidence_attachments")

class ComplianceFramework(str, enum.Enum):
    iso27001 = "ISO27001"
    nist_csf = "NIST_CSF"
    pci_dss = "PCI_DSS"
    owasp = "OWASP"
    mitre = "MITRE"

class ComplianceMapping(Base):
    __tablename__ = "compliance_mappings"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("findings.id", ondelete="CASCADE"), nullable=False)
    framework: Mapped[ComplianceFramework] = mapped_column(Enum(ComplianceFramework), nullable=False)
    control_id: Mapped[str] = mapped_column(String(50), nullable=False)
    control_name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    finding: Mapped["Finding"] = relationship("Finding", back_populates="compliance_mappings")

class ComplianceControl(Base):
    __tablename__ = "compliance_controls"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    framework: Mapped[ComplianceFramework] = mapped_column(Enum(ComplianceFramework), nullable=False)
    control_id: Mapped[str] = mapped_column(String(50), nullable=False)
    control_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
