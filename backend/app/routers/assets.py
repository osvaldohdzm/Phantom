from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.deps.auth import AuthContext, get_auth_context, require_write
from app.database import get_db
from app.models.core import Asset, AssetSourceType, Environment
from app.models.scan import AssetScanTarget
from app.schemas import (
    AssetBulkUpsertRequest,
    AssetBulkUpsertResponse,
    AssetCreate,
    AssetRead,
    AssetScanTargetActionResponse,
    AssetScanTargetImportResponse,
    AssetScanTargetPassRequest,
    AssetScanTargetPromoteRequest,
    AssetScanTargetRead,
    AssetScanTargetRefreshResponse,
    AssetSourceTypeEnum,
    EnvironmentEnum,
)
from app.services.asset_scan_import import import_scan_file_for_targets
from app.services.asset_scan_targets import pass_scan_targets, promote_scan_targets, refresh_scan_targets

router = APIRouter(prefix="/assets", tags=["assets"])

MAX_LIST = 5000
MAX_SCAN_IMPORT_MB = 150


def _serialize_asset(asset: Asset) -> AssetRead:
    return AssetRead(
        id=asset.id,
        nombre=asset.nombre,
        ip_publica=asset.ip_publica,
        ip_privada=asset.ip_privada,
        fqdn=asset.fqdn,
        criticidad=asset.criticidad,
        ambiente=EnvironmentEnum(asset.ambiente.value),
        os=asset.os,
        asset_type=asset.asset_type,
        owner=asset.owner,
        location=asset.location,
        last_scan_date=asset.last_scan_date,
        discovery_method=asset.discovery_method,
        is_in_scope=asset.is_in_scope,
        scope_version=asset.scope_version,
        source_type=AssetSourceTypeEnum(asset.source_type.value),
        engagement_id=asset.engagement_id,
        metadata=asset.extra_metadata or {},
    )


def _apply_payload(asset: Asset, payload: AssetCreate, *, tenant_id: UUID) -> None:
    asset.nombre = payload.nombre.strip() or asset.nombre or "Activo sin nombre"
    asset.ip_publica = payload.ip_publica
    asset.ip_privada = payload.ip_privada
    asset.fqdn = payload.fqdn
    asset.criticidad = payload.criticidad
    asset.ambiente = Environment(payload.ambiente.value)
    asset.os = payload.os
    asset.asset_type = payload.asset_type
    asset.owner = payload.owner
    asset.location = payload.location
    asset.last_scan_date = payload.last_scan_date
    asset.discovery_method = payload.discovery_method
    asset.is_in_scope = payload.is_in_scope
    asset.scope_version = payload.scope_version
    asset.source_type = AssetSourceType(payload.source_type.value)
    asset.engagement_id = payload.engagement_id
    asset.extra_metadata = payload.metadata or {}
    asset.tenant_id = tenant_id


@router.get("", response_model=list[AssetRead])
def list_assets(
    source_type: Optional[AssetSourceTypeEnum] = Query(None),
    engagement_id: Optional[UUID] = Query(None),
    limit: int = Query(500, ge=1, le=MAX_LIST),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> list[AssetRead]:
    q = db.query(Asset).filter(Asset.tenant_id == ctx.tenant_id)
    if source_type is not None:
        q = q.filter(Asset.source_type == AssetSourceType(source_type.value))
    if engagement_id is not None:
        q = q.filter(Asset.engagement_id == engagement_id)
    assets = q.order_by(Asset.nombre.asc()).limit(limit).all()
    return [_serialize_asset(a) for a in assets]


@router.get("/scan-targets", response_model=list[AssetScanTargetRead])
def list_scan_targets(
    status: Optional[str] = Query("pending"),
    engagement_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> list[AssetScanTargetRead]:
    q = db.query(AssetScanTarget).filter(AssetScanTarget.tenant_id == ctx.tenant_id)
    if status and status != "all":
        q = q.filter(AssetScanTarget.status == status)
    if engagement_id is not None:
        q = q.filter(
            (AssetScanTarget.engagement_id == engagement_id) | (AssetScanTarget.engagement_id.is_(None))
        )
    rows = q.order_by(AssetScanTarget.finding_count.desc(), AssetScanTarget.display_name).limit(2000).all()
    return [
        AssetScanTargetRead(
            id=r.id,
            target_key=r.target_key,
            display_name=r.display_name,
            componente_afectado=r.componente_afectado,
            tool_sources=list(r.tool_sources or []),
            finding_count=r.finding_count,
            status=r.status,
            target_source_type=r.target_source_type,
            promoted_asset_id=r.promoted_asset_id,
            engagement_id=r.engagement_id,
        )
        for r in rows
    ]


@router.post("/scan-targets/refresh", response_model=AssetScanTargetRefreshResponse)
def refresh_scan_targets_endpoint(
    engagement_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetScanTargetRefreshResponse:
    stats = refresh_scan_targets(db, tenant_id=ctx.tenant_id, engagement_id=engagement_id)
    return AssetScanTargetRefreshResponse(
        discovered=stats["discovered"],
        pending=stats["pending"],
        message=f"{stats['discovered']} objetivo(s) nuevos · {stats['pending']} pendientes en cola",
    )


@router.post("/scan-targets/import", response_model=AssetScanTargetImportResponse)
async def import_scan_targets_file(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    promote_source_type: Optional[AssetSourceTypeEnum] = Form(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetScanTargetImportResponse:
    """Importa Nessus CSV o Nmap (XML/GNMAP/txt) y alimenta la cola de objetivos desde escaneos."""
    raw = await file.read()
    if len(raw) > MAX_SCAN_IMPORT_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Archivo mayor a {MAX_SCAN_IMPORT_MB} MB")
    if engagement_id is not None:
        from app.deps.auth import require_engagement_tenant

        require_engagement_tenant(db, engagement_id, ctx.tenant_id)

    promote_type = (
        AssetSourceType(promote_source_type.value) if promote_source_type is not None else None
    )
    result = import_scan_file_for_targets(
        db,
        data=raw,
        filename=file.filename or "scan",
        tenant_id=ctx.tenant_id,
        engagement_id=engagement_id,
        refresh_engagement_id=engagement_id,
        promote_source_type=promote_type,
    )
    return AssetScanTargetImportResponse(**result)


@router.post("/scan-targets/promote", response_model=AssetScanTargetActionResponse)
def promote_scan_targets_endpoint(
    payload: AssetScanTargetPromoteRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetScanTargetActionResponse:
    if not payload.target_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un objetivo")
    result = promote_scan_targets(
        db,
        tenant_id=ctx.tenant_id,
        target_ids=payload.target_ids,
        source_type=AssetSourceType(payload.source_type.value),
        engagement_id=payload.engagement_id,
    )
    return AssetScanTargetActionResponse(
        processed=result["processed"],
        asset_ids=result["asset_ids"],
        message=f"{result['processed']} activo(s) agregados al inventario",
    )


@router.post("/scan-targets/pass", response_model=AssetScanTargetActionResponse)
def pass_scan_targets_endpoint(
    payload: AssetScanTargetPassRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetScanTargetActionResponse:
    if not payload.target_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un objetivo")
    n = pass_scan_targets(db, tenant_id=ctx.tenant_id, target_ids=payload.target_ids)
    return AssetScanTargetActionResponse(
        processed=n,
        message=f"{n} objetivo(s) omitidos (no entrarán al inventario)",
    )


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> AssetRead:
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.tenant_id == ctx.tenant_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return _serialize_asset(asset)


@router.post("", response_model=AssetRead)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetRead:
    a = Asset(tenant_id=ctx.tenant_id, nombre=payload.nombre or "Activo sin nombre")
    _apply_payload(a, payload, tenant_id=ctx.tenant_id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return _serialize_asset(a)


@router.post("/bulk-upsert", response_model=AssetBulkUpsertResponse)
def bulk_upsert_assets(
    payload: AssetBulkUpsertRequest,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetBulkUpsertResponse:
    if len(payload.rows) > 2000:
        raise HTTPException(status_code=400, detail="Máximo 2000 filas por operación")

    created = 0
    updated = 0
    deleted = 0
    saved: list[Asset] = []

    for row in payload.rows:
        if not row.nombre.strip() and not row.ip_publica and not row.ip_privada and not row.fqdn:
            continue
        if row.id:
            asset = (
                db.query(Asset)
                .filter(Asset.id == row.id, Asset.tenant_id == ctx.tenant_id)
                .first()
            )
            if not asset:
                raise HTTPException(status_code=404, detail=f"Activo no encontrado: {row.id}")
            _apply_payload(asset, row, tenant_id=ctx.tenant_id)
            updated += 1
        else:
            asset = Asset(tenant_id=ctx.tenant_id, nombre=row.nombre or "Activo sin nombre")
            _apply_payload(asset, row, tenant_id=ctx.tenant_id)
            db.add(asset)
            created += 1
        saved.append(asset)

    for del_id in payload.delete_ids:
        asset = db.query(Asset).filter(Asset.id == del_id, Asset.tenant_id == ctx.tenant_id).first()
        if asset:
            db.delete(asset)
            deleted += 1

    db.commit()
    for asset in saved:
        db.refresh(asset)

    return AssetBulkUpsertResponse(
        created=created,
        updated=updated,
        deleted=deleted,
        rows=[_serialize_asset(a) for a in saved],
    )


@router.put("/{asset_id}", response_model=AssetRead)
def update_asset(
    asset_id: UUID,
    payload: AssetCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetRead:
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.tenant_id == ctx.tenant_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    _apply_payload(asset, payload, tenant_id=ctx.tenant_id)
    db.commit()
    db.refresh(asset)
    return _serialize_asset(asset)


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict[str, str]:
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.tenant_id == ctx.tenant_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    db.delete(asset)
    db.commit()
    return {"message": "Activo eliminado exitosamente"}
