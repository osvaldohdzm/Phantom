from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.auth import Tenant, TenantMembership, User, UserRole
from app.services.jwt_tokens import decode_access_token

_bearer = HTTPBearer(auto_error=False)

_PASSWORD_CHANGE_ALLOWED = (
    "/api/v1/auth/me",
    "/api/v1/auth/change-password",
)


def _password_change_allowed(path: str) -> bool:
    return any(path.rstrip("/").endswith(suffix) for suffix in _PASSWORD_CHANGE_ALLOWED)

WRITE_ROLES = {UserRole.platform_admin, UserRole.tenant_admin, UserRole.analyst}
ADMIN_ROLES = {UserRole.platform_admin, UserRole.tenant_admin}
PORTAL_ROLES = {UserRole.client_viewer, UserRole.tenant_admin, UserRole.platform_admin, UserRole.analyst}


@dataclass
class AuthContext:
    user: User
    tenant_id: UUID
    role: UserRole
    membership: TenantMembership


def _dev_bypass_user(db: Session) -> AuthContext:
    tenant = db.query(Tenant).order_by(Tenant.created_at).first()
    user = db.query(User).order_by(User.created_at).first()
    if not tenant or not user:
        raise HTTPException(
            status_code=503,
            detail="Auth deshabilitado pero no hay tenant/usuario semilla. Reinicia el backend.",
        )
    membership = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user.id,
            TenantMembership.tenant_id == tenant.id,
        )
        .first()
    )
    if not membership:
        membership = TenantMembership(user_id=user.id, tenant_id=tenant.id, role=UserRole.tenant_admin)
        db.add(membership)
        db.commit()
        db.refresh(membership)
    return AuthContext(user=user, tenant_id=tenant.id, role=membership.role, membership=membership)


def get_auth_context(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> AuthContext:
    if not settings.auth_required:
        return _dev_bypass_user(db)

    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Autenticación requerida")

    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user_id = UUID(payload["sub"])
    tenant_id = UUID(payload["tenant_id"])
    role_name = payload.get("role", UserRole.analyst.value)

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no válido")

    membership = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user.id,
            TenantMembership.tenant_id == tenant_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Sin acceso a este tenant")

    try:
        role = UserRole(role_name)
    except ValueError:
        role = membership.role

    if user.must_change_password and not _password_change_allowed(request.url.path):
        raise HTTPException(
            status_code=403,
            detail="password_change_required",
        )

    return AuthContext(user=user, tenant_id=tenant_id, role=role, membership=membership)


def require_roles(*allowed: UserRole):
    allowed_set = set(allowed)

    def _dep(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if ctx.role not in allowed_set and ctx.role != UserRole.platform_admin:
            raise HTTPException(status_code=403, detail="Permiso denegado")
        return ctx

    return _dep


def require_write(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if ctx.role == UserRole.client_viewer:
        raise HTTPException(status_code=403, detail="Solo lectura para rol cliente")
    if ctx.role not in WRITE_ROLES and ctx.role != UserRole.platform_admin:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    return ctx


def engagement_in_tenant(db: Session, engagement_id: UUID, tenant_id: UUID) -> bool:
    from app.models.core import Engagement

    eg = db.get(Engagement, engagement_id)
    return eg is not None and eg.tenant_id == tenant_id


def require_engagement_tenant(db: Session, engagement_id: UUID, tenant_id: UUID) -> None:
    if not engagement_in_tenant(db, engagement_id, tenant_id):
        raise HTTPException(status_code=404, detail="Engagement no encontrado en este tenant")


def tenant_findings_filter(query, tenant_id: UUID):
    from app.models.core import Engagement, Finding

    return query.join(Engagement, Finding.engagement_id == Engagement.id).filter(
        Engagement.tenant_id == tenant_id
    )


def filter_engagement_ids(db: Session, tenant_id: UUID) -> Iterable[UUID]:
    from app.models.core import Engagement

    rows = db.query(Engagement.id).filter(Engagement.tenant_id == tenant_id).all()
    return [r[0] for r in rows]


def actor_email(ctx: AuthContext) -> str:
    return ctx.user.email


def require_admin(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if ctx.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return ctx


def user_has_platform_admin(db: Session, user_id: UUID) -> bool:
    return (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.role == UserRole.platform_admin,
        )
        .first()
        is not None
    )


def is_effective_platform_admin(ctx: AuthContext, db: Session) -> bool:
    return ctx.role == UserRole.platform_admin or user_has_platform_admin(db, ctx.user.id)


def require_platform_admin(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuthContext:
    if not is_effective_platform_admin(ctx, db):
        raise HTTPException(status_code=403, detail="Solo administradores de plataforma")
    return ctx


def get_finding_in_tenant(db: Session, finding_id: UUID, tenant_id: UUID):
    from app.models.core import Finding

    f = db.get(Finding, finding_id)
    if not f or not f.engagement_id:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
    require_engagement_tenant(db, f.engagement_id, tenant_id)
    return f


def ensure_findings_in_tenant(db: Session, findings: list, tenant_id: UUID) -> None:
    for f in findings:
        if not f.engagement_id:
            raise HTTPException(status_code=403, detail="Hallazgo sin proyecto asociado")
        require_engagement_tenant(db, f.engagement_id, tenant_id)


def get_report_job_in_tenant(db: Session, job_id: UUID, tenant_id: UUID):
    from app.models.reports import ReportJob

    job = db.get(ReportJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if job.engagement_id:
        require_engagement_tenant(db, job.engagement_id, tenant_id)
    return job


def get_template_in_tenant(db: Session, template_id: UUID, tenant_id: UUID):
    from app.models.reports import DocxTemplate

    tpl = db.get(DocxTemplate, template_id)
    if not tpl or tpl.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return tpl


def tenant_report_jobs_query(db: Session, tenant_id: UUID):
    from app.models.core import Engagement
    from app.models.reports import ReportJob

    eg_ids = filter_engagement_ids(db, tenant_id)
    return db.query(ReportJob).filter(ReportJob.engagement_id.in_(eg_ids))
