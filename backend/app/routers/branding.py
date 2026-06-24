"""API de white-label / tenant branding."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, get_auth_context, is_effective_platform_admin, require_admin
from app.models.auth import Tenant, UserRole
from app.schemas import TenantBrandingPublicRead, TenantBrandingRead, TenantBrandingUpdate
from app.services.audit import log_audit_event
from app.services.tenant_branding import (
    ALLOWED_IMAGE_EXT,
    BRANDING_ASSET_SLOTS,
    SLOT_TO_URL_KEY,
    branding_asset_url,
    merge_branding_update,
    normalize_branding,
)
from app.services.tenant_utils import normalize_tenant_slug

router = APIRouter(prefix="/branding", tags=["branding"])

STORAGE_ROOT = Path("storage/branding")
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
MAX_ASSET_MB = 8


def _branding_read(tenant: Tenant) -> TenantBrandingRead:
    return TenantBrandingRead(**normalize_branding(tenant.branding))


def _ensure_tenant_branding_access(ctx: AuthContext, tenant_id: UUID, db: Session) -> None:
    if is_effective_platform_admin(ctx, db):
        return
    if ctx.role != UserRole.tenant_admin:
        raise HTTPException(status_code=403, detail="Sin permisos de administración")
    if ctx.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Solo puedes editar el tenant activo")


def _tenant_dir(tenant_id: UUID) -> Path:
    path = STORAGE_ROOT / str(tenant_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.get("/public/{slug}", response_model=TenantBrandingPublicRead)
def public_branding_by_slug(slug: str, db: Session = Depends(get_db)) -> TenantBrandingPublicRead:
    try:
        normalized = normalize_tenant_slug(slug)
    except ValueError:
        raise HTTPException(status_code=400, detail="Slug inválido")
    tenant = (
        db.query(Tenant)
        .filter(Tenant.slug == normalized, Tenant.is_active.is_(True))
        .first()
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return TenantBrandingPublicRead(
        tenant_id=tenant.id,
        slug=tenant.slug,
        nombre=tenant.nombre,
        branding=_branding_read(tenant),
    )


@router.get("/tenants/{tenant_id}", response_model=TenantBrandingRead)
def get_tenant_branding(
    tenant_id: UUID,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> TenantBrandingRead:
    _ensure_tenant_branding_access(ctx, tenant_id, db)
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    return _branding_read(tenant)


@router.patch("/tenants/{tenant_id}", response_model=TenantBrandingRead)
def update_tenant_branding(
    tenant_id: UUID,
    payload: TenantBrandingUpdate,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> TenantBrandingRead:
    _ensure_tenant_branding_access(ctx, tenant_id, db)
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    patch = payload.model_dump(exclude_unset=True)
    tenant.branding = merge_branding_update(tenant.branding, patch)
    log_audit_event(
        db,
        action="admin.tenant_branding_updated",
        actor_id=ctx.user.id,
        tenant_id=tenant.id,
        resource_type="tenant",
        resource_id=str(tenant.id),
        details={"keys": list(patch.keys())},
    )
    db.commit()
    db.refresh(tenant)
    return _branding_read(tenant)


@router.post("/tenants/{tenant_id}/assets/{slot}", response_model=TenantBrandingRead)
async def upload_branding_asset(
    tenant_id: UUID,
    slot: str,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> TenantBrandingRead:
    if slot not in BRANDING_ASSET_SLOTS:
        raise HTTPException(status_code=400, detail=f"Slot inválido: {slot}")

    _ensure_tenant_branding_access(ctx, tenant_id, db)
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo requerido")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no permitido. Usa: {', '.join(sorted(ALLOWED_IMAGE_EXT))}",
        )

    raw = await file.read()
    if len(raw) > MAX_ASSET_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Archivo mayor a {MAX_ASSET_MB} MB")

    filename = f"{slot}{ext}"
    dest = _tenant_dir(tenant_id) / filename
    dest.write_bytes(raw)

    url_key = SLOT_TO_URL_KEY[slot]
    branding = normalize_branding(tenant.branding)
    branding[url_key] = branding_asset_url(tenant_id, filename)
    tenant.branding = branding

    log_audit_event(
        db,
        action="admin.tenant_branding_asset_uploaded",
        actor_id=ctx.user.id,
        tenant_id=tenant.id,
        resource_type="tenant_branding",
        resource_id=slot,
        details={"filename": filename},
    )
    db.commit()
    db.refresh(tenant)
    return _branding_read(tenant)


@router.delete("/tenants/{tenant_id}/assets/{slot}", response_model=TenantBrandingRead)
def delete_branding_asset(
    tenant_id: UUID,
    slot: str,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> TenantBrandingRead:
    if slot not in BRANDING_ASSET_SLOTS:
        raise HTTPException(status_code=400, detail=f"Slot inválido: {slot}")

    _ensure_tenant_branding_access(ctx, tenant_id, db)
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    url_key = SLOT_TO_URL_KEY[slot]
    branding = normalize_branding(tenant.branding)
    current_url = branding.get(url_key)
    if current_url:
        filename = Path(str(current_url)).name
        file_path = _tenant_dir(tenant_id) / filename
        if file_path.is_file():
            file_path.unlink()

    branding[url_key] = None
    tenant.branding = branding
    db.commit()
    db.refresh(tenant)
    return _branding_read(tenant)


@router.get("/assets/{tenant_id}/{filename}")
def serve_branding_asset(tenant_id: UUID, filename: str) -> FileResponse:
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    path = _tenant_dir(tenant_id) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return FileResponse(path)
