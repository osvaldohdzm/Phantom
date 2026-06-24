"""Espacio interno por tenant — almacén técnico, no un servicio listable en UI."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth import Tenant
from app.models.core import Asset, Engagement, EngagementType

# Nombre interno (no debe mostrarse como servicio en la UI).
DEFAULT_SERVICE_NAME = "Espacio del tenant"
DEFAULT_PROJECT_NAME = DEFAULT_SERVICE_NAME  # compat
DEFAULT_ESTADO = "En curso"
DEFAULT_TIPO_SERVICIO = "Pentest"


def is_default_engagement(eg: Engagement) -> bool:
    profile = eg.profile or {}
    if profile.get("is_default"):
        return True
    name = (eg.nombre_proyecto or "").strip()
    return name in (
        DEFAULT_SERVICE_NAME,
        "Proyecto Default",
        "Servicio Default",
    )


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


def detach_assets_from_default_engagements(db: Session) -> None:
    """Los activos no deben quedar atados al espacio interno; inventario global del tenant."""
    for tenant in db.query(Tenant).all():
        default_eg = get_default_engagement(db, tenant.id)
        if not default_eg:
            continue
        db.query(Asset).filter(
            Asset.tenant_id == tenant.id,
            Asset.engagement_id == default_eg.id,
        ).update({Asset.engagement_id: None}, synchronize_session=False)


def backfill_orphan_assets_to_default(db: Session) -> None:
    """Los activos sin proyecto permanecen con engagement_id NULL (inventario global)."""
    return


def bootstrap_tenant_defaults(db: Session) -> None:
    ensure_default_engagements_all_tenants(db)
    detach_assets_from_default_engagements(db)
