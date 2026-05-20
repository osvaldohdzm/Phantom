import enum
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Environment(str, enum.Enum):
    prod = "Prod"
    dev = "Dev"


class Severity(str, enum.Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"
    info = "Info"


class FindingStatus(str, enum.Enum):
    abierta = "Abierta"
    en_proceso = "En Proceso"
    remediada = "Remediada"
    validada = "Validada"
    falso_positivo = "Falso Positivo"
    riesgo_aceptado = "Riesgo Aceptado"


class EngagementType(str, enum.Enum):
    black_box = "Caja Negra"
    grey_box = "Caja Gris"
    white_box = "Caja Blanca"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_publica: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    ip_privada: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    fqdn: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    criticidad: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ambiente: Mapped[Environment] = mapped_column(Enum(Environment), nullable=False, default=Environment.prod)

    findings: Mapped[List["Finding"]] = relationship(back_populates="asset")


class VulnerabilityCatalog(Base):
    __tablename__ = "vulnerabilities"
    __table_args__ = {"schema": "core"}

    Id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    VulnerabilityUnifiedId: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    DefaultVulnerabilityName: Mapped[str] = mapped_column(String(512), nullable=False)
    Vulnerability: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    Severity: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    SourceDetection: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    Version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    Description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    Danger: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    Solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    SolutionType: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    References: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    CVE: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    CWE: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    CVSSBaseScore3_1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    CVSSOverallScore3_1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    EspSeveridad: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    EspDescripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    EspAmenaza: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    EspRemediacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    BANOBRASCategoryName: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    BANOBRASTipoVulnerabilidad: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    findings: Mapped[List["Finding"]] = relationship(back_populates="catalog_entry")


class Engagement(Base):
    __tablename__ = "engagements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tipo: Mapped[EngagementType] = mapped_column(Enum(EngagementType), nullable=False)

    findings: Mapped[List["Finding"]] = relationship(back_populates="engagement")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titulo: Mapped[str] = mapped_column(String(512), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severidad: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False, default=Severity.medium)
    cvss_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cvss_vector: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    cve: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    cwe: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    evidencia_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    status: Mapped[FindingStatus] = mapped_column(Enum(FindingStatus), nullable=False, default=FindingStatus.abierta)
    raw_tool_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explicacion_tecnica: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amenaza_ampliada: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owasp_category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    mitre_technique_id: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=True
    )
    catalog_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("core.vulnerabilities.Id"), nullable=True
    )

    asset: Mapped[Optional["Asset"]] = relationship(back_populates="findings")
    engagement: Mapped[Optional["Engagement"]] = relationship(back_populates="findings")
    catalog_entry: Mapped[Optional["VulnerabilityCatalog"]] = relationship(back_populates="findings")
    remediation_plans: Mapped[List["RemediationPlan"]] = relationship(back_populates="finding")


class RemediationPlan(Base):
    __tablename__ = "remediation_plan"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False)
    responsable: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_compromiso: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado_remediacion: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    finding: Mapped["Finding"] = relationship(back_populates="remediation_plans")
