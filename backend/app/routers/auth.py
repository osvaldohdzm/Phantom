from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, get_auth_context
from app.models.auth import Tenant, TenantMembership, User, UserRole
from app.schemas import (
    AuthChangePasswordRequest,
    AuthLoginRequest,
    AuthLoginResponse,
    AuthMeResponse,
    AuthSwitchTenantRequest,
    AuthTenantInfo,
    AuthUserInfo,
    TenantBrandingRead,
    UserPreferencesUpdate,
)
from app.services.audit import log_audit_event
from app.services.jwt_tokens import create_access_token
from app.services.password_policy import validate_password_strength
from app.services.passwords import hash_password, verify_password
from app.services.tenant_branding import normalize_branding
from app.services.tenant_locale import resolve_tenant_language
from app.services.user_preferences import normalize_user_preferences, resolve_ui_language

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_info(user: User, tenant: Tenant | None) -> AuthUserInfo:
    tenant_lang = resolve_tenant_language(tenant.branding if tenant else None)
    prefs = normalize_user_preferences(user.preferences)
    pref = prefs["ui_language"]
    return AuthUserInfo(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        ui_language_preference=pref,
        ui_language=resolve_ui_language(user.preferences, tenant_lang),
        must_change_password=bool(getattr(user, "must_change_password", False)),
    )


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
        user=_user_info(user, db.get(Tenant, preferred)),
        active_tenant_id=preferred,
        role=role.value,
        tenants=tenants,
        branding=_active_branding(db, preferred),
    )


@router.get("/me", response_model=AuthMeResponse)
def me(ctx: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)) -> AuthMeResponse:
    tenant = db.get(Tenant, ctx.tenant_id)
    return AuthMeResponse(
        user=_user_info(ctx.user, tenant),
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
        user=_user_info(ctx.user, db.get(Tenant, payload.tenant_id)),
        active_tenant_id=payload.tenant_id,
        role=role.value,
        tenants=tenants,
        branding=_active_branding(db, payload.tenant_id),
    )


@router.patch("/me/preferences", response_model=AuthMeResponse)
def update_my_preferences(
    payload: UserPreferencesUpdate,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuthMeResponse:
    if ctx.user.must_change_password:
        raise HTTPException(
            status_code=403,
            detail="Debes cambiar la contraseña antes de continuar",
        )
    prefs = normalize_user_preferences(ctx.user.preferences)
    if payload.ui_language is not None:
        prefs["ui_language"] = payload.ui_language
    ctx.user.preferences = prefs
    db.add(ctx.user)
    db.commit()
    db.refresh(ctx.user)
    tenant = db.get(Tenant, ctx.tenant_id)
    return AuthMeResponse(
        user=_user_info(ctx.user, tenant),
        active_tenant_id=ctx.tenant_id,
        role=ctx.role.value,
        tenants=_tenant_infos(db, ctx.user.id),
        branding=_active_branding(db, ctx.tenant_id),
    )


@router.post("/change-password", response_model=AuthLoginResponse)
def change_password(
    payload: AuthChangePasswordRequest,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuthLoginResponse:
    user = ctx.user
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="La nueva contraseña debe ser distinta a la actual",
        )

    policy_errors = validate_password_strength(payload.new_password, login=user.email)
    if policy_errors:
        raise HTTPException(
            status_code=400,
            detail="Contraseña no cumple la política: " + "; ".join(policy_errors),
        )

    was_forced = user.must_change_password
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.add(user)

    token, role = _issue_token(db, user, ctx.tenant_id)
    tenants = _tenant_infos(db, user.id)

    log_audit_event(
        db,
        action="auth.password_changed",
        actor_id=user.id,
        tenant_id=ctx.tenant_id,
        ip_address=request.client.host if request.client else None,
        details={"email": user.email, "forced": was_forced},
    )
    db.commit()

    return AuthLoginResponse(
        access_token=token,
        token_type="bearer",
        user=_user_info(user, db.get(Tenant, ctx.tenant_id)),
        active_tenant_id=ctx.tenant_id,
        role=role.value,
        tenants=tenants,
        branding=_active_branding(db, ctx.tenant_id),
    )
