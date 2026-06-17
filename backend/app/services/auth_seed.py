from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.auth import Tenant, TenantMembership, User, UserRole
from app.models.core import Asset, Engagement
from app.models.reports import DocxTemplate
from app.services.default_engagement import bootstrap_tenant_defaults, ensure_default_engagement
from app.services.passwords import hash_password, verify_password

DEFAULT_TENANT_SLUG = "Phantom-interno"
DEMO_TENANT_SLUG = "cliente-demo"


def _get_or_create_tenant(db: Session, slug: str, nombre: str) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if tenant:
        return tenant
    tenant = Tenant(slug=slug, nombre=nombre)
    db.add(tenant)
    db.flush()
    ensure_default_engagement(db, tenant)
    return tenant


def _ensure_membership(db: Session, user_id, tenant_id, role: UserRole) -> None:
    exists = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.tenant_id == tenant_id,
        )
        .first()
    )
    if not exists:
        db.add(TenantMembership(user_id=user_id, tenant_id=tenant_id, role=role))


def _ensure_user(
    db: Session,
    email: str,
    nombre: str,
    password: str,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            nombre=nombre,
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()
        return user
    if not verify_password(password, user.password_hash):
        user.password_hash = hash_password(password)
        user.is_active = True
    return user


def seed_auth_data(db: Session) -> None:
    """Idempotente: tenants, usuarios semilla y membresías."""
    tenant_main = _get_or_create_tenant(db, DEFAULT_TENANT_SLUG, "Phantom Interno")
    tenant_demo = _get_or_create_tenant(db, DEMO_TENANT_SLUG, "Cliente Demo")

    admin = _ensure_user(db, "admin@Phantom.local", "Administrador", "admin123")
    analyst = _ensure_user(db, "analyst@Phantom.local", "Analista SecOps", "analyst123")
    client = _ensure_user(db, "cliente@demo.local", "Usuario Cliente", "client123")

    _ensure_membership(db, admin.id, tenant_main.id, UserRole.platform_admin)
    _ensure_membership(db, admin.id, tenant_demo.id, UserRole.tenant_admin)
    _ensure_membership(db, analyst.id, tenant_main.id, UserRole.analyst)
    _ensure_membership(db, client.id, tenant_demo.id, UserRole.client_viewer)

    db.query(Engagement).filter(Engagement.tenant_id.is_(None)).update(
        {Engagement.tenant_id: tenant_main.id},
        synchronize_session=False,
    )
    db.query(Asset).filter(Asset.tenant_id.is_(None)).update(
        {Asset.tenant_id: tenant_main.id},
        synchronize_session=False,
    )
    db.query(DocxTemplate).filter(DocxTemplate.tenant_id.is_(None)).update(
        {DocxTemplate.tenant_id: tenant_main.id},
        synchronize_session=False,
    )
    bootstrap_tenant_defaults(db)
    db.commit()
    print("Auth: tenants y usuarios semilla listos.")


def backfill_tenant_ids(db: Session) -> None:
    """Asigna tenant por defecto a filas legacy sin tenant_id."""
    tenant = db.query(Tenant).order_by(Tenant.created_at).first()
    if not tenant:
        return
    tid = tenant.id
    db.query(Engagement).filter(Engagement.tenant_id.is_(None)).update(
        {Engagement.tenant_id: tid}, synchronize_session=False
    )
    db.query(Asset).filter(Asset.tenant_id.is_(None)).update(
        {Asset.tenant_id: tid}, synchronize_session=False
    )
    db.query(DocxTemplate).filter(DocxTemplate.tenant_id.is_(None)).update(
        {DocxTemplate.tenant_id: tid}, synchronize_session=False
    )
    bootstrap_tenant_defaults(db)
    db.commit()
