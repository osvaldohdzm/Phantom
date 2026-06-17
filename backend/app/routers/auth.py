from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, get_auth_context
from app.models.auth import Tenant, TenantMembership, User, UserRole
from app.schemas import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthMeResponse,
    AuthSwitchTenantRequest,
    AuthTenantInfo,
    AuthUserInfo,
    TenantBrandingRead,
)
from app.services.audit import log_audit_event
from app.services.jwt_tokens import create_access_token
from app.services.passwords import verify_password
from app.services.tenant_branding import normalize_branding

router = APIRouter(prefix="/auth", tags=["auth"])


def _branding_for_tenant(tenant: Tenant) -> TenantBrandingRead:
    return TenantBrandingRead(**normalize_branding(tenant.branding))


def _tenant_infos(db: Session, user_id: UUID) -> list[AuthTenantInfo]:
    rows = (
        db.query(TenantMembership, Tenant)
        .join(Tenant, Tenant.id == TenantMembership.tenant_id)
        .filter(TenantMembership.user_id == user_id, Tenant.is_active.is_(True))
        .order_by(Tenant.nombre)
        .all()
    )
    return [
        AuthTenantInfo(
            id=m.tenant_id,
            slug=t.slug,
            nombre=t.nombre,
            role=m.role.value,
            branding=_branding_for_tenant(t),
        )
        for m, t in rows
    ]


def _active_branding(db: Session, tenant_id: UUID) -> TenantBrandingRead | None:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        return None
    return _branding_for_tenant(tenant)


def _issue_token(db: Session, user: User, tenant_id: UUID) -> tuple[str, UserRole]:
    membership = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user.id,
            TenantMembership.tenant_id == tenant_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Sin membresía en el tenant")
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        tenant_id=tenant_id,
        role=membership.role.value,
    )
    return token, membership.role


@router.post("/login", response_model=AuthLoginResponse)
def login(payload: AuthLoginRequest, request: Request, db: Session = Depends(get_db)) -> AuthLoginResponse:
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    memberships = (
        db.query(TenantMembership)
        .filter(TenantMembership.user_id == user.id)
        .order_by(TenantMembership.id)
        .all()
    )
    if not memberships:
        raise HTTPException(status_code=403, detail="Usuario sin tenants asignados")

    preferred = payload.tenant_id or memberships[0].tenant_id
    token, role = _issue_token(db, user, preferred)
    tenants = _tenant_infos(db, user.id)

    log_audit_event(
        db,
        action="auth.login",
        actor_id=user.id,
        tenant_id=preferred,
        ip_address=request.client.host if request.client else None,
        details={"email": user.email},
    )
    db.commit()

    return AuthLoginResponse(
        access_token=token,
        token_type="bearer",
        user=AuthUserInfo(id=user.id, email=user.email, nombre=user.nombre),
        active_tenant_id=preferred,
        role=role.value,
        tenants=tenants,
        branding=_active_branding(db, preferred),
    )


@router.get("/me", response_model=AuthMeResponse)
def me(ctx: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)) -> AuthMeResponse:
    return AuthMeResponse(
        user=AuthUserInfo(id=ctx.user.id, email=ctx.user.email, nombre=ctx.user.nombre),
        active_tenant_id=ctx.tenant_id,
        role=ctx.role.value,
        tenants=_tenant_infos(db, ctx.user.id),
        branding=_active_branding(db, ctx.tenant_id),
    )


@router.post("/switch-tenant", response_model=AuthLoginResponse)
def switch_tenant(
    payload: AuthSwitchTenantRequest,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuthLoginResponse:
    token, role = _issue_token(db, ctx.user, payload.tenant_id)
    tenants = _tenant_infos(db, ctx.user.id)

    log_audit_event(
        db,
        action="auth.switch_tenant",
        actor_id=ctx.user.id,
        tenant_id=payload.tenant_id,
        ip_address=request.client.host if request.client else None,
        details={"from": str(ctx.tenant_id), "to": str(payload.tenant_id)},
    )
    db.commit()

    return AuthLoginResponse(
        access_token=token,
        token_type="bearer",
        user=AuthUserInfo(id=ctx.user.id, email=ctx.user.email, nombre=ctx.user.nombre),
        active_tenant_id=payload.tenant_id,
        role=role.value,
        tenants=tenants,
        branding=_active_branding(db, payload.tenant_id),
    )
