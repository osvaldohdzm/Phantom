"""Importa Nessus CSV / Nmap en la cola de objetivos desde escaneos (Activos M2)."""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.deps.auth import require_engagement_tenant
from app.models.auth import Tenant
from app.models.core import AssetSourceType
from app.models.scan import AssetScanTarget
from app.services.asset_scan_targets import (
    dedupe_target_drafts,
    ensure_scan_targets_from_target_drafts,
    promote_scan_targets,
    refresh_scan_targets,
    upsert_assets_from_scan_drafts,
)
from app.services.catalog_from_draft import ensure_drafts_catalog
from app.services.default_engagement import ensure_default_engagement
from app.services.parse_nessus_csv import parse_nessus_csv_bytes, parse_nessus_scan_targets_csv_bytes
from app.services.parse_nmap_scan import parse_nmap_bytes
from app.services.vulns_catalog_lookup import enrich_drafts_with_catalog

_ATTACK_SURFACE_TYPES = frozenset(
    {
        AssetSourceType.external_attack_surface,
        AssetSourceType.internal_attack_surface,
    }
)

_INVENTORY_DESTINATIONS = frozenset(
    {
        AssetSourceType.inventory,
        AssetSourceType.external_recon,
        AssetSourceType.internal_recon,
        AssetSourceType.external_attack_surface,
        AssetSourceType.internal_attack_surface,
    }
)


def _detect_and_parse(
    data: bytes,
    filename: str,
    *,
    targets_only: bool,
) -> tuple[str, list[dict[str, Any]]]:
    low = (filename or "scan").lower()
    if low.endswith(".csv"):
        if targets_only:
            drafts = parse_nessus_scan_targets_csv_bytes(data)
        else:
            drafts = parse_nessus_csv_bytes(data)
        if drafts:
            return "nessus-csv", drafts
        raise HTTPException(
            status_code=400,
            detail="No se extrajeron filas del CSV. Comprueba que sea export Nessus/Tenable (.csv).",
        )

    drafts = parse_nmap_bytes(data, filename or "scan")
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail=(
                "No se detectaron hosts/puertos en el archivo. "
                "Usa Nmap XML (-oX .xml), .gnmap o salida de texto (.nmap, .txt)."
            ),
        )
    return "nmap", drafts


def import_scan_file_for_targets(
    db: Session,
    *,
    data: bytes,
    filename: str,
    tenant_id: UUID,
    engagement_id: Optional[UUID],
    refresh_engagement_id: Optional[UUID] = None,
    promote_source_type: Optional[AssetSourceType] = None,
    targets_only: bool = True,
) -> dict[str, Any]:
    """Importa escaneo para Activos M2. Por defecto solo objetivos (sin hallazgos de vulnerabilidad)."""
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    import_engagement_id = engagement_id
    used_default = False
    if import_engagement_id is None:
        import_engagement_id = ensure_default_engagement(db, tenant).id
        used_default = True
    else:
        require_engagement_tenant(db, import_engagement_id, tenant_id)

    source, drafts = _detect_and_parse(data, filename, targets_only=targets_only)
    unique = dedupe_target_drafts(drafts)
    import_keys = set(unique.keys())
    refresh_filter = refresh_engagement_id if refresh_engagement_id is not None else import_engagement_id

    created_count = 0
    if targets_only:
        stats = ensure_scan_targets_from_target_drafts(
            db,
            tenant_id=tenant_id,
            drafts=list(unique.values()),
            engagement_id=refresh_filter,
        )
    else:
        from app.routers.ingest import _persist_drafts

        bulk = len(drafts) > 2000
        if not bulk:
            enrich_drafts_with_catalog(db, drafts, tenant_id=tenant_id)
            ensure_drafts_catalog(db, drafts, fast_mode=False)

        ids = _persist_drafts(
            db,
            drafts,
            import_engagement_id,
            tenant_id,
            fast_bulk=bulk,
        )
        created_count = len(ids) if ids else len(drafts)
        stats = refresh_scan_targets(
            db,
            tenant_id=tenant_id,
            engagement_id=refresh_filter,
            only_keys=import_keys if import_keys else None,
        )

    assets_created = 0
    assets_updated = 0
    promoted = 0
    if promote_source_type is not None and promote_source_type in _INVENTORY_DESTINATIONS:
        upsert = upsert_assets_from_scan_drafts(
            db,
            tenant_id=tenant_id,
            drafts=list(unique.values()),
            source_type=promote_source_type,
            engagement_id=import_engagement_id,
        )
        assets_created = upsert["created"]
        assets_updated = upsert["updated"]
    elif promote_source_type is not None and import_keys and not targets_only:
        pending_rows = (
            db.query(AssetScanTarget)
            .filter(
                AssetScanTarget.tenant_id == tenant_id,
                AssetScanTarget.status == "pending",
                AssetScanTarget.target_key.in_(list(import_keys)),
            )
            .all()
        )
        if pending_rows:
            result = promote_scan_targets(
                db,
                tenant_id=tenant_id,
                target_ids=[r.id for r in pending_rows],
                source_type=promote_source_type,
                engagement_id=import_engagement_id,
            )
            promoted = int(result.get("processed") or 0)

    return {
        "source": source,
        "created_count": created_count,
        "unique_targets": len(unique),
        "targets_only": targets_only,
        "discovered": stats["discovered"],
        "reopened": stats.get("reopened", 0),
        "pending": stats["pending"],
        "import_keys": len(import_keys),
        "assets_created": assets_created,
        "assets_updated": assets_updated,
        "promoted": promoted,
        "promote_source_type": promote_source_type.value if promote_source_type else None,
        "engagement_id": import_engagement_id,
        "used_default_engagement": used_default,
        "message": None,
    }
