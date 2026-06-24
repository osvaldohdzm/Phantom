from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import (
    AuthContext,
    actor_email,
    is_effective_platform_admin,
    require_admin,
    require_platform_admin,
)
from app.models.auth import AuditEvent, Tenant, TenantMembership, User, UserRole
from app.models.core import Engagement
from app.models.scan import TenantKind
from app.schemas import (
    AdminAuditEventRead,
    AdminDatabaseRuntimeRead,
    AdminDeploymentEnvRead,
    AdminDeploymentProfileRead,
    AdminTenantCreate,
    AdminTenantRead,
    AdminTenantUpdate,
    AdminUserCreate,
    AdminUserRead,
    AdminUserRoleUpdate,
    AdminMembershipRead,
    AdminUserWithMembershipsRead,
    AdminMembershipAssign,
    AdminUserMembershipsSet,
    UserRoleEnum,
)
from app.services.audit import log_audit_event
from app.services.default_engagement import ensure_default_engagement
from app.services.passwords import hash_password
from app.services.rbac import Capability, role_has_capability
from app.services.tenant_cleanup import purge_tenant_vuln_data
from app.services.tenant_branding import merge_branding_update, normalize_branding
from app.services.tenant_utils import normalize_tenant_slug
from app.services.database_config import (
    build_env_template,
    deployment_profiles,
    runtime_database_info,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _tenant_read(db: Session, tenant: Tenant) -> AdminTenantRead:
    users_count = (
        db.query(TenantMembership).filter(TenantMembership.tenant_id == tenant.id).count()
    )
    engagements_count = (
        db.query(Engagement).filter(Engagement.tenant_id == tenant.id).count()
    )
    return AdminTenantRead(
        id=tenant.id,
        slug=tenant.slug,
        nombre=tenant.nombre,
        descripcion=tenant.descripcion,
        is_active=tenant.is_active,
        tenant_kind=tenant.tenant_kind.value if tenant.tenant_kind else "pentest",
        created_at=tenant.created_at,
        users_count=users_count,
        engagements_count=engagements_count,
    )


@router.get("/database/runtime", response_model=AdminDatabaseRuntimeRead)
def get_database_runtime_config(
    ctx: AuthContext = Depends(require_platform_admin),
) -> AdminDatabaseRuntimeRead:
    return AdminDatabaseRuntimeRead(**runtime_database_info())


@router.get("/database/deployment-profiles", response_model=List[AdminDeploymentProfileRead])
def list_deployment_profiles(
    ctx: AuthContext = Depends(require_platform_admin),
) -> List[AdminDeploymentProfileRead]:
    return [AdminDeploymentProfileRead(**p) for p in deployment_profiles()]


@router.get("/database/deployment-env/{profile_id}", response_model=AdminDeploymentEnvRead)
def get_deployment_env_template(
    profile_id: str,
    ctx: AuthContext = Depends(require_platform_admin),
) -> AdminDeploymentEnvRead:
    allowed = {p["id"] for p in deployment_profiles()}
    if profile_id not in allowed:
        raise HTTPException(status_code=404, detail="Perfil de despliegue no encontrado")
    profile = next(p for p in deployment_profiles() if p["id"] == profile_id)
    return AdminDeploymentEnvRead(
        profile_id=profile_id,
        env_content=build_env_template(profile_id),  # type: ignore[arg-type]
        filename=profile["env_file_name"],
    )


@router.get("/tenants", response_model=List[AdminTenantRead])
def list_tenants(
    ctx: AuthContext = Depends(require_platform_admin),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
) -> List[AdminTenantRead]:
    query = db.query(Tenant).order_by(Tenant.nombre)
    if not include_inactive:
        query = query.filter(Tenant.is_active.is_(True))
    return [_tenant_read(db, t) for t in query.all()]


@router.post("/tenants", response_model=AdminTenantRead)
def create_tenant(
    payload: AdminTenantCreate,
    request: Request,
    ctx: AuthContext = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> AdminTenantRead:
    try:
        slug = normalize_tenant_slug(payload.slug)
    except ValueError:
        raise HTTPException(status_code=400, detail="Slug inválido")

    if db.query(Tenant).filter(Tenant.slug == slug).first():
        raise HTTPException(status_code=409, detail="Ya existe un tenant con ese slug")

    tenant = Tenant(
        slug=slug,
        nombre=payload.nombre.strip(),
        descripcion=(payload.descripcion or "").strip() or None,
        is_active=True,
        tenant_kind=TenantKind(payload.tenant_kind or "pentest"),
        branding=merge_branding_update(
            None,
            {"language": payload.default_language or "es"},
        ),
    )
    db.add(tenant)
    db.flush()

    ensure_default_engagement(db, tenant)

    if payload.add_me_as_admin:
        _ensure_membership(db, ctx.user.id, tenant.id, UserRole.tenant_admin)

    log_audit_event(
        db,
        action="admin.tenant_created",
        actor_id=ctx.user.id,
        tenant_id=tenant.id,
        resource_type="tenant",
        resource_id=str(tenant.id),
        ip_address=request.client.host if request.client else None,
        details={"slug": slug, "nombre": tenant.nombre},
    )
    db.commit()
    db.refresh(tenant)
    return _tenant_read(db, tenant)


@router.get("/tenants/{tenant_id}", response_model=AdminTenantRead)
def get_tenant(
    tenant_id: UUID,
    ctx: AuthContext = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> AdminTenantRead:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    return _tenant_read(db, tenant)


@router.patch("/tenants/{tenant_id}", response_model=AdminTenantRead)
def update_tenant(
    tenant_id: UUID,
    payload: AdminTenantUpdate,
    request: Request,
    ctx: AuthContext = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> AdminTenantRead:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] is not None:
        try:
            slug = normalize_tenant_slug(data["slug"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Slug inválido")
        other = db.query(Tenant).filter(Tenant.slug == slug, Tenant.id != tenant_id).first()
        if other:
            raise HTTPException(status_code=409, detail="Slug ya en uso")
        tenant.slug = slug
    if "nombre" in data and data["nombre"] is not None:
        tenant.nombre = data["nombre"].strip()
    if "descripcion" in data:
        tenant.descripcion = (data["descripcion"] or "").strip() or None
    if "is_active" in data and data["is_active"] is not None:
        tenant.is_active = data["is_active"]
    if "tenant_kind" in data and data["tenant_kind"] is not None:
        tenant.tenant_kind = TenantKind(data["tenant_kind"])

    log_audit_event(
        db,
        action="admin.tenant_updated",
        actor_id=ctx.user.id,
        tenant_id=tenant.id,
        resource_type="tenant",
        resource_id=str(tenant.id),
        ip_address=request.client.host if request.client else None,
        details=data,
    )
    db.commit()
    db.refresh(tenant)
    return _tenant_read(db, tenant)


@router.delete("/tenants/{tenant_id}")
def delete_tenant(
    tenant_id: UUID,
    request: Request,
    purge: bool = Query(
        False,
        description="Si true, borra proyectos y datos de gestión vulnerable antes de eliminar el tenant.",
    ),
    confirm_slug: Optional[str] = Query(
        None,
        description="Slug exacto del tenant; obligatorio cuando purge=true.",
    ),
    ctx: AuthContext = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> dict:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    engagements = db.query(Engagement).filter(Engagement.tenant_id == tenant_id).count()
    if engagements > 0 and not purge:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar: el tenant tiene {engagements} proyecto(s). "
                "Usa purge=true y confirm_slug para borrar también la gestión vulnerable "
                "(el catálogo global no se modifica)."
            ),
        )

    purge_stats: dict[str, int] = {}
    if purge:
        if not confirm_slug or confirm_slug.strip().lower() != tenant.slug.lower():
            raise HTTPException(
                status_code=400,
                detail="Confirmación inválida: escribe el slug exacto del tenant para borrar con datos.",
            )
        purge_stats = purge_tenant_vuln_data(db, tenant_id)

    db.query(TenantMembership).filter(TenantMembership.tenant_id == tenant_id).delete(
        synchronize_session=False
    )

    slug = tenant.slug
    db.delete(tenant)
    log_audit_event(
        db,
        action="admin.tenant_deleted",
        actor_id=ctx.user.id,
        tenant_id=None,
        resource_type="tenant",
        resource_id=str(tenant_id),
        ip_address=request.client.host if request.client else None,
        details={"slug": slug, "purge": purge, "purge_stats": purge_stats},
    )
    db.commit()
    return {"deleted": True, "id": str(tenant_id), "purge": purge, "purge_stats": purge_stats}


def _ensure_membership(db: Session, user_id: UUID, tenant_id: UUID, role: UserRole) -> None:
    exists = (
        db.query(TenantMembership)
        .filter(TenantMembership.user_id == user_id, TenantMembership.tenant_id == tenant_id)
        .first()
    )
    if not exists:
        db.add(TenantMembership(user_id=user_id, tenant_id=tenant_id, role=role))


def _memberships_read(
    db: Session,
    user_id: UUID,
    *,
    scope_tenant_id: Optional[UUID] = None,
) -> List[AdminMembershipRead]:
    query = (
        db.query(TenantMembership, Tenant)
        .join(Tenant, Tenant.id == TenantMembership.tenant_id)
        .filter(TenantMembership.user_id == user_id)
        .order_by(Tenant.nombre)
    )
    if scope_tenant_id is not None:
        query = query.filter(TenantMembership.tenant_id == scope_tenant_id)
    return [
        AdminMembershipRead(
            membership_id=m.id,
            tenant_id=t.id,
            tenant_slug=t.slug,
            tenant_nombre=t.nombre,
            role=m.role.value,
        )
        for m, t in query.all()
    ]


def _user_with_memberships(
    db: Session,
    user: User,
    *,
    scope_tenant_id: Optional[UUID] = None,
) -> AdminUserWithMembershipsRead:
    return AdminUserWithMembershipsRead(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        is_active=user.is_active,
        memberships=_memberships_read(db, user.id, scope_tenant_id=scope_tenant_id),
    )


def _resolve_tenant_ids_for_create(
    payload_tenant_ids: Optional[List[UUID]],
    ctx: AuthContext,
    db: Session,
) -> List[UUID]:
    ids = list(payload_tenant_ids or [ctx.tenant_id])
    if not is_effective_platform_admin(ctx, db):
        ids = [tid for tid in ids if tid == ctx.tenant_id]
        if not ids:
            ids = [ctx.tenant_id]
    return ids


def _assert_role_assignable(role: UserRoleEnum, ctx: AuthContext, db: Session) -> None:
    if role == UserRoleEnum.platform_admin and not is_effective_platform_admin(ctx, db):
        raise HTTPException(status_code=403, detail="Solo platform_admin puede asignar ese rol")


@router.get("/users", response_model=List[AdminUserWithMembershipsRead])
def list_users_with_memberships(
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminUserWithMembershipsRead]:
    if is_effective_platform_admin(ctx, db):
        users = db.query(User).order_by(User.nombre).all()
        return [_user_with_memberships(db, u) for u in users]

    rows = (
        db.query(User)
        .join(TenantMembership, TenantMembership.user_id == User.id)
        .filter(TenantMembership.tenant_id == ctx.tenant_id)
        .order_by(User.nombre)
        .all()
    )
    return [
        _user_with_memberships(db, u, scope_tenant_id=ctx.tenant_id) for u in rows
    ]


@router.put("/users/{user_id}/memberships", response_model=AdminUserWithMembershipsRead)
def set_user_memberships(
    user_id: UUID,
    payload: AdminUserMembershipsSet,
    request: Request,
    ctx: AuthContext = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> AdminUserWithMembershipsRead:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not payload.memberships:
        raise HTTPException(status_code=400, detail="Debe haber al menos un tenant asignado")

    seen_tenants: set[UUID] = set()
    desired: list[tuple[UUID, UserRole]] = []
    for item in payload.memberships:
        if item.tenant_id in seen_tenants:
            raise HTTPException(status_code=400, detail="Tenant duplicado en la lista")
        seen_tenants.add(item.tenant_id)
        tenant = db.get(Tenant, item.tenant_id)
        if not tenant or not tenant.is_active:
            raise HTTPException(status_code=404, detail=f"Tenant no encontrado: {item.tenant_id}")
        desired.append((item.tenant_id, UserRole(item.role.value)))

    existing = (
        db.query(TenantMembership)
        .filter(TenantMembership.user_id == user_id)
        .all()
    )
    existing_by_tenant = {m.tenant_id: m for m in existing}

    for tenant_id, role in desired:
        if tenant_id in existing_by_tenant:
            existing_by_tenant[tenant_id].role = role
        else:
            db.add(TenantMembership(user_id=user_id, tenant_id=tenant_id, role=role))

    desired_ids = {t for t, _ in desired}
    for m in existing:
        if m.tenant_id not in desired_ids:
            if user_id == ctx.user.id and len(desired_ids) == 0:
                raise HTTPException(status_code=400, detail="No puedes quitarte de todos los tenants")
            db.delete(m)

    log_audit_event(
        db,
        action="admin.user_memberships_set",
        actor_id=ctx.user.id,
        tenant_id=ctx.tenant_id,
        resource_type="user",
        resource_id=str(user_id),
        ip_address=request.client.host if request.client else None,
        details={
            "memberships": [
                {"tenant_id": str(t), "role": r.value} for t, r in desired
            ]
        },
    )
    db.commit()
    return _user_with_memberships(db, user)


@router.post("/users/{user_id}/memberships", response_model=AdminUserWithMembershipsRead)
def add_user_membership(
    user_id: UUID,
    payload: AdminMembershipAssign,
    request: Request,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserWithMembershipsRead:
    _assert_role_assignable(payload.role, ctx, db)
    if not is_effective_platform_admin(ctx, db) and payload.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Solo puedes asignar usuarios al tenant activo")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    tenant = db.get(Tenant, payload.tenant_id)
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    dup = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.tenant_id == payload.tenant_id,
        )
        .first()
    )
    if dup:
        dup.role = UserRole(payload.role.value)
    else:
        db.add(
            TenantMembership(
                user_id=user_id,
                tenant_id=payload.tenant_id,
                role=UserRole(payload.role.value),
            )
        )

    log_audit_event(
        db,
        action="admin.user_added_to_tenant",
        actor_id=ctx.user.id,
        tenant_id=payload.tenant_id,
        resource_type="user",
        resource_id=str(user_id),
        ip_address=request.client.host if request.client else None,
        details={"email": user.email, "role": payload.role.value},
    )
    db.commit()
    scope = None if is_effective_platform_admin(ctx, db) else ctx.tenant_id
    return _user_with_memberships(db, user, scope_tenant_id=scope)


@router.delete("/users/{user_id}/memberships/{tenant_id}")
def remove_user_membership(
    user_id: UUID,
    tenant_id: UUID,
    request: Request,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if not is_effective_platform_admin(ctx, db) and tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Solo puedes quitar usuarios del tenant activo")
    if user_id == ctx.user.id and tenant_id == ctx.tenant_id:
        other = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.user_id == user_id,
                TenantMembership.tenant_id != tenant_id,
            )
            .count()
        )
        if other == 0:
            raise HTTPException(status_code=400, detail="No puedes quitarte del único tenant")

    membership = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.tenant_id == tenant_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Membresía no encontrada")

    db.delete(membership)
    log_audit_event(
        db,
        action="admin.user_removed_from_tenant",
        actor_id=ctx.user.id,
        tenant_id=tenant_id,
        resource_type="user",
        resource_id=str(user_id),
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"removed": True, "user_id": str(user_id), "tenant_id": str(tenant_id)}


def _user_read(db: Session, user: User, tenant_id: UUID) -> AdminUserRead:
    m = (
        db.query(TenantMembership)
        .filter(TenantMembership.user_id == user.id, TenantMembership.tenant_id == tenant_id)
        .first()
    )
    return AdminUserRead(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        is_active=user.is_active,
        role=m.role.value if m else "analyst",
    )


@router.get("/tenant-users", response_model=List[AdminUserRead])
def list_tenant_users(
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminUserRead]:
    rows = (
        db.query(User, TenantMembership)
        .join(TenantMembership, TenantMembership.user_id == User.id)
        .filter(TenantMembership.tenant_id == ctx.tenant_id)
        .order_by(User.nombre)
        .all()
    )
    return [
        AdminUserRead(
            id=u.id,
            email=u.email,
            nombre=u.nombre,
            is_active=u.is_active,
            role=m.role.value,
        )
        for u, m in rows
    ]


@router.post("/tenant-users", response_model=AdminUserRead)
def create_tenant_user(
    payload: AdminUserCreate,
    request: Request,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserRead:
    _assert_role_assignable(payload.role, ctx, db)
    tenant_ids = _resolve_tenant_ids_for_create(payload.tenant_ids, ctx, db)
    for tid in tenant_ids:
        tenant = db.get(Tenant, tid)
        if not tenant or not tenant.is_active:
            raise HTTPException(status_code=404, detail=f"Tenant no encontrado: {tid}")

    email = payload.email.strip().lower()
    role = UserRole(payload.role.value)
    existing = db.query(User).filter(User.email == email).first()

    if existing:
        user = existing
        for tid in tenant_ids:
            dup = (
                db.query(TenantMembership)
                .filter(
                    TenantMembership.user_id == user.id,
                    TenantMembership.tenant_id == tid,
                )
                .first()
            )
            if dup:
                dup.role = role
            else:
                db.add(
                    TenantMembership(user_id=user.id, tenant_id=tid, role=role)
                )
        log_audit_event(
            db,
            action="admin.user_added_to_tenant",
            actor_id=ctx.user.id,
            tenant_id=ctx.tenant_id,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=request.client.host if request.client else None,
            details={"email": email, "role": role.value, "tenant_ids": [str(t) for t in tenant_ids]},
        )
        db.commit()
        return _user_read(db, user, ctx.tenant_id)

    user = User(
        email=email,
        nombre=payload.nombre.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    for tid in tenant_ids:
        db.add(TenantMembership(user_id=user.id, tenant_id=tid, role=role))
    log_audit_event(
        db,
        action="admin.user_created",
        actor_id=ctx.user.id,
        tenant_id=ctx.tenant_id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
        details={"email": email, "role": role.value, "tenant_ids": [str(t) for t in tenant_ids]},
    )
    db.commit()
    db.refresh(user)
    return _user_read(db, user, ctx.tenant_id)


@router.patch("/tenant-users/{user_id}/role", response_model=AdminUserRead)
def update_tenant_user_role(
    user_id: UUID,
    payload: AdminUserRoleUpdate,
    request: Request,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserRead:
    _assert_role_assignable(payload.role, ctx, db)
    if user_id == ctx.user.id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol")

    tenant_id = payload.tenant_id or ctx.tenant_id
    if not is_effective_platform_admin(ctx, db) and tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Solo puedes cambiar roles en el tenant activo")

    membership = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.user_id == user_id,
            TenantMembership.tenant_id == tenant_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en este tenant")

    membership.role = UserRole(payload.role.value)
    user = db.get(User, user_id)
    log_audit_event(
        db,
        action="admin.user_role_updated",
        actor_id=ctx.user.id,
        tenant_id=tenant_id,
        resource_type="user",
        resource_id=str(user_id),
        ip_address=request.client.host if request.client else None,
        details={"role": payload.role.value, "tenant_id": str(tenant_id)},
    )
    db.commit()
    return _user_read(db, user, tenant_id)


@router.get("/audit-events", response_model=List[AdminAuditEventRead])
def list_audit_events(
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = 50,
) -> List[AdminAuditEventRead]:
    if not role_has_capability(ctx.role, Capability.tenant_audit_view):
        raise HTTPException(status_code=403, detail="Sin permiso para ver auditoría")

    safe = min(max(limit, 1), 200)
    platform_view = is_effective_platform_admin(ctx, db)
    query = db.query(AuditEvent)
    if not platform_view:
        query = query.filter(AuditEvent.tenant_id == ctx.tenant_id)
    rows = query.order_by(AuditEvent.created_at.desc()).limit(safe).all()

    tenant_ids = {r.tenant_id for r in rows if r.tenant_id}
    actor_ids = {r.actor_id for r in rows if r.actor_id}
    tenant_names: dict[UUID, str] = {}
    if tenant_ids:
        for t in db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all():
            tenant_names[t.id] = t.nombre
    actor_emails: dict[UUID, str] = {}
    if actor_ids:
        for u in db.query(User).filter(User.id.in_(actor_ids)).all():
            actor_emails[u.id] = u.email

    return [
        AdminAuditEventRead(
            id=r.id,
            action=r.action,
            actor_id=r.actor_id,
            actor_email=actor_emails.get(r.actor_id) if r.actor_id else None,
            tenant_id=r.tenant_id,
            tenant_nombre=tenant_names.get(r.tenant_id) if r.tenant_id else None,
            resource_type=r.resource_type,
            resource_id=r.resource_id,
            ip_address=r.ip_address,
            details=r.details,
            created_at=r.created_at,
        )
        for r in rows
    ]
