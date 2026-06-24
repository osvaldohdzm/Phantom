"""Importa Nessus CSV / Nmap en la cola de objetivos desde escaneos (Activos M2)."""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.deps.auth import require_engagement_tenant
from app.models.auth import Tenant
from app.services.asset_scan_targets import refresh_scan_targets
from app.services.catalog_from_draft import ensure_drafts_catalog
from app.services.default_engagement import ensure_default_engagement
from app.services.finding_duplicates import normalize_affected_component
from app.services.parse_nessus_csv import parse_nessus_csv_bytes
from app.services.parse_nmap_scan import parse_nmap_bytes
from app.services.vulns_catalog_lookup import enrich_drafts_with_catalog


def _detect_and_parse(data: bytes, filename: str) -> tuple[str, list[dict[str, Any]]]:
    low = (filename or "scan").lower()
    if low.endswith(".csv"):
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
) -> dict[str, Any]:
    """Persiste hallazgos del escaneo y actualiza la cola de objetivos pendientes."""
    # Import tardío: reutiliza persistencia de ingesta sin refactor masivo.
    from app.routers.ingest import _persist_drafts

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

    source, drafts = _detect_and_parse(data, filename)
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

    import_keys: set[str] = set()
    for draft in drafts:
        comp = (draft.get("componente_afectado") or "").strip()
        if not comp:
            continue
        key = normalize_affected_component(comp)
        if key:
            import_keys.add(key)

    refresh_filter = refresh_engagement_id if refresh_engagement_id is not None else engagement_id
    stats = refresh_scan_targets(
        db,
        tenant_id=tenant_id,
        engagement_id=refresh_filter,
        only_keys=import_keys if import_keys else None,
    )

    source_label = "Nessus CSV" if source == "nessus-csv" else "Nmap"
    unique_ports = len(import_keys)
    msg = (
        f"{len(ids) if ids else len(drafts):,} hallazgo(s) importados desde {source_label}. "
        f"{stats['discovered']} objetivo(s) nuevo(s) · {stats['pending']} pendiente(s) en cola."
    )
    if stats["discovered"] == 0 and unique_ports > 0:
        msg += (
            f" ({unique_ports:,} host:puerto en este archivo; "
            "si ya importaste Nessus, pueden estar en cola con otra fuente — revisa la tabla o filtra por Nmap)."
        )
    if used_default and engagement_id is None:
        msg += " (almacenados en el espacio interno del tenant)"

    return {
        "source": source,
        "created_count": len(ids) if ids else len(drafts),
        "discovered": stats["discovered"],
        "pending": stats["pending"],
        "message": msg,
        "engagement_id": import_engagement_id,
    }
