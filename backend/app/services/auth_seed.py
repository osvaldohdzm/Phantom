from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.auth import Tenant, TenantMembership, User, UserRole
from app.models.core import Asset, Engagement
from app.models.reports import DocxTemplate
from app.services.default_engagement import bootstrap_tenant_defaults, ensure_default_engagement
from app.services.passwords import hash_password, verify_password

DEFAULT_TENANT_SLUG = "Phantom-interno"
DEMO_TENANT_SLUG = "cliente-demo"
DEFAULT_ADMIN_LOGIN = "phantom"
DEFAULT_ADMIN_PASSWORD = "phantom"
DEFAULT_ADMIN_NAME = "Administrador"
LEGACY_ADMIN_LOGINS = (
    "admin@phantom.local",
    "admin@Phantom.local",
    "admin@spectra.local",
    "admin@Spectra.local",
)


def is_legacy_admin_login(email: str) -> bool:
    """Logins heredados que deben normalizarse a «phantom»."""
    normalized = email.strip().lower()
    if normalized == DEFAULT_ADMIN_LOGIN:
        return False
    if normalized in {login.lower() for login in LEGACY_ADMIN_LOGINS}:
        return True
    return normalized.startswith("admin@") and normalized.endswith(".local")


def _get_or_create_tenant(db: Session, slug: str, nombre: str) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if tenant:
        return tenant
    tenant = Tenant(slug=slug, nombre=nombre)
    db.add(tenant)
    db.flush()
    ensure_default_engagement(db, tenant)
    return tenant


_ROLE_RANK = {
    UserRole.platform_admin: 4,
    UserRole.tenant_admin: 3,
    UserRole.analyst: 2,
    UserRole.client_viewer: 1,
}


def _find_membership(db: Session, user_id, tenant_id) -> TenantMembership | None:
    """Membresía persistida o pendiente de flush en la misma sesión."""
    exists = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.tenant_id == tenant_id,
        )
        .first()
    )
    if exists:
        return exists
    for obj in db.new:
        if (
            isinstance(obj, TenantMembership)
            and obj.user_id == user_id
            and obj.tenant_id == tenant_id
        ):
            return obj
    return None


def _ensure_membership(db: Session, user_id, tenant_id, role: UserRole) -> None:
    exists = _find_membership(db, user_id, tenant_id)
    if not exists:
        db.add(TenantMembership(user_id=user_id, tenant_id=tenant_id, role=role))
    elif _ROLE_RANK.get(role, 0) > _ROLE_RANK.get(exists.role, 0):
        exists.role = role


def ensure_default_admin_platform_privileges(db: Session) -> None:
    """Garantiza platform_admin en todos los tenants para el admin por defecto."""
    admin = db.query(User).filter(User.email == DEFAULT_ADMIN_LOGIN).first()
    if not admin:
        return
    for tenant in db.query(Tenant).all():
        _ensure_membership(db, admin.id, tenant.id, UserRole.platform_admin)


def _ensure_user(
    db: Session,
    email: str,
    nombre: str,
    password: str,
    *,
    reset_password: bool = False,
) -> User:
    """Crea usuario semilla si no existe. No sobrescribe contraseña salvo reset_password=True."""
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
    if reset_password and not verify_password(password, user.password_hash):
        user.password_hash = hash_password(password)
    if nombre and not (user.nombre or "").strip():
        user.nombre = nombre
    user.is_active = True
    return user


def migrate_legacy_admin_login(db: Session) -> User | None:
    """Renombra logins admin heredados (p. ej. admin@spectra.local) → phantom."""
    target = db.query(User).filter(User.email == DEFAULT_ADMIN_LOGIN).first()
    if target:
        return target

    legacy_admin = (
        db.query(User)
        .join(TenantMembership, TenantMembership.user_id == User.id)
        .filter(TenantMembership.role == UserRole.platform_admin)
        .order_by(User.created_at)
        .first()
    )
    if legacy_admin and is_legacy_admin_login(legacy_admin.email):
        legacy_admin.email = DEFAULT_ADMIN_LOGIN
        db.flush()
        return legacy_admin

    for legacy in LEGACY_ADMIN_LOGINS:
        legacy_user = db.query(User).filter(User.email == legacy).first()
        if legacy_user:
            legacy_user.email = DEFAULT_ADMIN_LOGIN
            db.flush()
            return legacy_user

    return None


def seed_auth_data(db: Session) -> None:
    """Idempotente: tenants, usuarios semilla y membresías."""
    tenant_main = _get_or_create_tenant(db, DEFAULT_TENANT_SLUG, "Phantom Interno")
    tenant_demo = _get_or_create_tenant(db, DEMO_TENANT_SLUG, "Cliente Demo")

    migrate_legacy_admin_login(db)
    admin = _ensure_user(db, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_PASSWORD)
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
    ensure_default_admin_platform_privileges(db)
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
