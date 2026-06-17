import uuid
import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Integer
from app.models.db_types import PortableUUID, PortableJSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReportJobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ReportKind(str, enum.Enum):
    """Tipo de exportación Word guardada en historial."""

    vulnerability_tables = "vulnerability_tables"
    findings_table = "findings_table"


class DocxTemplate(Base):
    """Plantilla Word (.docx) con marcadores «Nombre de columna»."""

    __tablename__ = "docx_templates"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    placeholders: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("tenants.id"), nullable=True
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="admin")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class ReportJob(Base):
    """Registro de generación de reportes Word."""

    __tablename__ = "report_jobs"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=True
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID,
        ForeignKey("docx_templates.id", ondelete="CASCADE"),
        nullable=True,
    )
    report_kind: Mapped[ReportKind] = mapped_column(
        Enum(ReportKind, native_enum=False, length=40),
        nullable=False,
        default=ReportKind.vulnerability_tables,
    )
    grouped_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[ReportJobStatus] = mapped_column(
        Enum(ReportJobStatus), nullable=False, default=ReportJobStatus.pending
    )
    finding_ids: Mapped[list] = mapped_column(PortableJSON, nullable=False, default=list)
    output_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    individual_paths: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True)
    findings_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="admin")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
