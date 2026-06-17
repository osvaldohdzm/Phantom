"""Proyecto Default por tenant — contenedor de inventario, hallazgos e importaciones."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth import Tenant
from app.models.core import Asset, Engagement, EngagementType

DEFAULT_SERVICE_NAME = "Servicio Default"
DEFAULT_PROJECT_NAME = DEFAULT_SERVICE_NAME  # compat
DEFAULT_ESTADO = "En curso"
DEFAULT_TIPO_SERVICIO = "Pentest"


def is_default_engagement(eg: Engagement) -> bool:
    profile = eg.profile or {}
    if profile.get("is_default"):
        return True
    name = (eg.nombre_proyecto or "").strip()
    return name in (DEFAULT_SERVICE_NAME, "Proyecto Default")


def get_default_engagement(db: Session, tenant_id: UUID) -> Engagement | None:
    for eg in db.query(Engagement).filter(Engagement.tenant_id == tenant_id).all():
        if is_default_engagement(eg):
            return eg
    return None


def ensure_default_engagement(db: Session, tenant: Tenant) -> Engagement:
    existing = get_default_engagement(db, tenant.id)
    if existing:
        return existing

    eg = Engagement(
        cliente=tenant.nombre,
        nombre_proyecto=DEFAULT_SERVICE_NAME,
        estado=DEFAULT_ESTADO,
        tipo_servicio=DEFAULT_TIPO_SERVICIO,
        fecha_inicio=date.today(),
        tipo=EngagementType.black_box,
        profile={"is_default": True},
        tenant_id=tenant.id,
    )
    db.add(eg)
    db.flush()
    return eg


def ensure_default_engagements_all_tenants(db: Session) -> None:
    for tenant in db.query(Tenant).all():
        ensure_default_engagement(db, tenant)


def backfill_orphan_assets_to_default(db: Session) -> None:
    """Asigna activos sin proyecto al Proyecto Default del tenant."""
    for tenant in db.query(Tenant).all():
        default_eg = ensure_default_engagement(db, tenant)
        db.query(Asset).filter(
            Asset.tenant_id == tenant.id,
            Asset.engagement_id.is_(None),
        ).update({Asset.engagement_id: default_eg.id}, synchronize_session=False)


def bootstrap_tenant_defaults(db: Session) -> None:
    ensure_default_engagements_all_tenants(db)
    backfill_orphan_assets_to_default(db)
