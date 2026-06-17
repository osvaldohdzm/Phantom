import enum
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, String, Text, Integer
from app.models.db_types import PortableUUID, PortableJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.catalog_sql import (
    vulnerability_catalog_fk,
    vulnerability_catalog_table_args,
    vulnerability_catalog_tablename,
)


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
    abierta = "Identificado"
    identificado = "Identificado"
    validada = "Validado"
    en_proceso = "En Proceso de Remediación"
    retest_pendiente = "Re-test Pendiente"
    retest_en_curso = "Re-test En Curso"
    cerrado = "Cerrado"
    falso_positivo = "Falso Positivo"
    riesgo_aceptado = "Riesgo Aceptado"
    atendido = "Atendido"
    remediado = "Remediado"
    reaparecido = "Reaparecido"


class EngagementType(str, enum.Enum):
    black_box = "Caja Negra"
    grey_box = "Caja Gris"
    white_box = "Caja Blanca"


class AssetSourceType(str, enum.Enum):
    inventory = "inventory"
    external_recon = "external_recon"
    external_attack_surface = "external_attack_surface"
    internal_recon = "internal_recon"
    internal_attack_surface = "internal_attack_surface"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_publica: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    ip_privada: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    fqdn: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    criticidad: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ambiente: Mapped[Environment] = mapped_column(Enum(Environment), nullable=False, default=Environment.prod)

    # Nuevos campos del CFR
    os: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    asset_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    owner: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_scan_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    discovery_method: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_in_scope: Mapped[bool] = mapped_column(default=True)
    scope_version: Mapped[Optional[int]] = mapped_column(nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("tenants.id"), nullable=True
    )
    source_type: Mapped[AssetSourceType] = mapped_column(
        Enum(AssetSourceType, native_enum=False, length=64),
        nullable=False,
        default=AssetSourceType.inventory,
    )
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("engagements.id"), nullable=True
    )
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", PortableJSON, nullable=True, default=dict)

    findings: Mapped[List["Finding"]] = relationship(back_populates="asset")
    vault_credentials: Mapped[List["VaultCredential"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class VulnerabilityCatalog(Base):
    __tablename__ = vulnerability_catalog_tablename()
    __table_args__ = vulnerability_catalog_table_args()

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

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    cliente: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre_proyecto: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    responsable: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tipo_servicio: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tipo: Mapped[EngagementType] = mapped_column(Enum(EngagementType), nullable=False)
    profile: Mapped[Optional[dict]] = mapped_column(PortableJSON, nullable=True, default=dict)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("tenants.id"), nullable=True
    )

    findings: Mapped[List["Finding"]] = relationship(back_populates="engagement")
    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="engagements")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
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
    componente_afectado: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metodo_deteccion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    tool_vuln_id: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    propuesta_remediacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    referencias: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    epss_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    kev_listed: Mapped[bool] = mapped_column(default=False)
    owasp_category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    mitre_technique_id: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    first_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    origin_projects: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True, default=list)
    detection_sources: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True, default=list)
    sync_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, default="pending")
    global_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, default="LOCAL")
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(PortableUUID, nullable=True)
    remediation_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dedup_fingerprint: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, index=True)
    lifecycle_history: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True, default=list)

    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(PortableUUID, ForeignKey("assets.id"), nullable=True)
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("engagements.id"), nullable=True
    )
    catalog_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey(vulnerability_catalog_fk()), nullable=True
    )

    asset: Mapped[Optional["Asset"]] = relationship(back_populates="findings")
    engagement: Mapped[Optional["Engagement"]] = relationship(back_populates="findings")
    catalog_entry: Mapped[Optional["VulnerabilityCatalog"]] = relationship(back_populates="findings")
    remediation_plans: Mapped[List["RemediationPlan"]] = relationship(
        back_populates="finding", cascade="all, delete-orphan"
    )
    
    evidence_attachments: Mapped[List["EvidenceAttachment"]] = relationship("EvidenceAttachment", back_populates="finding", cascade="all, delete-orphan")
    compliance_mappings: Mapped[List["ComplianceMapping"]] = relationship("ComplianceMapping", back_populates="finding", cascade="all, delete-orphan")


class RemediationPlan(Base):
    __tablename__ = "remediation_plan"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(
        PortableUUID, ForeignKey("findings.id", ondelete="CASCADE"), nullable=False
    )
    responsable: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_compromiso: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado_remediacion: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Nuevos campos del CFR para remediación y re-test
    sla_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    priority: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    retest_trigger: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    retest_count: Mapped[int] = mapped_column(Integer, default=0)
    last_retest_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_retest_result: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    history: Mapped[Optional[dict]] = mapped_column(PortableJSON, nullable=True)  # Historial de cambios de estado

    finding: Mapped["Finding"] = relationship(back_populates="remediation_plans")
