"""Escaneos recurrentes (AV/infra) y agrupación de activos."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from app.models.db_types import PortableJSON, PortableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TenantKind(str, enum.Enum):
    """Perfil operativo del tenant."""
    pentest = "pentest"
    av_infra = "av_infra"


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("tenants.id"), nullable=False)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        PortableUUID, ForeignKey("engagements.id"), nullable=False
    )
    tool_source: Mapped[str] = mapped_column(String(64), nullable=False, default="Nessus")
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    scope: Mapped[str] = mapped_column(String(32), nullable=False, default="tenant")
    absent_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="atendido")
    stats: Mapped[Optional[dict]] = mapped_column(PortableJSON, nullable=True, default=dict)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class AssetGroup(Base):
    __tablename__ = "asset_groups"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("tenants.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    members: Mapped[List["AssetGroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class AssetGroupMember(Base):
    __tablename__ = "asset_group_members"
    __table_args__ = (UniqueConstraint("group_id", "asset_id", name="uq_asset_group_member"),)

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        PortableUUID, ForeignKey("asset_groups.id", ondelete="CASCADE"), nullable=False
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        PortableUUID, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )

    group: Mapped["AssetGroup"] = relationship(back_populates="members")


class AssetScanTargetStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    passed = "passed"


class AssetScanTarget(Base):
    """Objetivo detectado en escaneos; el usuario decide si entra al inventario o se omite."""

    __tablename__ = "asset_scan_targets"
    __table_args__ = (UniqueConstraint("tenant_id", "target_key", name="uq_asset_scan_target_key"),)

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PortableUUID, ForeignKey("tenants.id"), nullable=False)
    engagement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("engagements.id"), nullable=True
    )
    target_key: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(512), nullable=False)
    componente_afectado: Mapped[str] = mapped_column(String(512), nullable=False)
    tool_sources: Mapped[Optional[list]] = mapped_column(PortableJSON, nullable=True, default=list)
    finding_count: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    target_source_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    promoted_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PortableUUID, ForeignKey("assets.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
