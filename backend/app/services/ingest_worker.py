"""Background worker for Redis ingest jobs (Python enrichment + persistence)."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import UUID

from app.database import SessionLocal
from app.models.scan import ScanRun
from app.models.core import AssetSourceType
from app.services.asset_scan_import import import_scan_file_for_targets
from app.services.catalog_from_draft import ensure_drafts_catalog
from app.services.finding_rescan import apply_nessus_rescan
from app.services.import_asset_scope import apply_asset_scope_to_drafts
from app.services.ingest_jobs import (
    IngestJobKind,
    IngestJobStatus,
    dequeue_ingest_job,
    get_ingest_job,
    update_ingest_job,
)
from app.services.parser_gateway import parse_nessus_csv_bytes, parse_nmap_bytes
from app.services.vulns_catalog_lookup import enrich_drafts_with_catalog

logger = logging.getLogger(__name__)

_worker_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


def start_ingest_worker() -> None:
    global _worker_thread
    from app.config import settings

    if not settings.ingest_worker_enabled:
        logger.info("ingest worker disabled (INGEST_WORKER_ENABLED=false)")
        return
    if _worker_thread and _worker_thread.is_alive():
        return
    _stop_event.clear()
    _worker_thread = threading.Thread(target=_worker_loop, name="phantom-ingest-worker", daemon=True)
    _worker_thread.start()
    logger.info("ingest worker started")


def stop_ingest_worker() -> None:
    _stop_event.set()


def _worker_loop() -> None:
    while not _stop_event.is_set():
        job_id = dequeue_ingest_job(timeout=3)
        if not job_id:
            continue
        try:
            _process_job(job_id)
        except Exception as exc:
            logger.exception("ingest job %s crashed: %s", job_id, exc)
            update_ingest_job(
                job_id,
                status=IngestJobStatus.failed.value,
                error=str(exc),
                progress_pct=100,
            )


def _process_job(job_id: str) -> None:
    job = get_ingest_job(job_id)
    if not job:
        return
    if job.get("status") not in (IngestJobStatus.queued.value,):
        return

    update_ingest_job(job_id, status=IngestJobStatus.parsing.value, progress_pct=5)
    path = Path(job["file_path"])
    if not path.is_file():
        update_ingest_job(
            job_id,
            status=IngestJobStatus.failed.value,
            error="upload file missing",
            progress_pct=100,
        )
        return

    data = path.read_bytes()
    kind = job.get("kind")
    params = job.get("params") or {}
    filename = job.get("filename") or path.name
    tenant_id = UUID(job["tenant_id"])
    engagement_id = UUID(job["engagement_id"]) if job.get("engagement_id") else None

    db = SessionLocal()
    try:
        if kind == IngestJobKind.scan_targets.value:
            promote_raw = params.get("promote_source_type")
            promote_type = AssetSourceType(promote_raw) if promote_raw else None
            result = import_scan_file_for_targets(
                db,
                data=data,
                filename=filename,
                tenant_id=tenant_id,
                engagement_id=engagement_id,
                refresh_engagement_id=UUID(params["refresh_engagement_id"])
                if params.get("refresh_engagement_id")
                else engagement_id,
                promote_source_type=promote_type,
                targets_only=bool(params.get("targets_only", True)),
            )
            update_ingest_job(
                job_id,
                status=IngestJobStatus.completed.value,
                progress_pct=100,
                completed_at=datetime.now(timezone.utc).isoformat(),
                result=result,
                message=result.get("message") or f"{result.get('unique_targets', 0)} targets",
            )
            return

        update_ingest_job(job_id, status=IngestJobStatus.parsing.value, progress_pct=15)
        if kind == IngestJobKind.nmap.value:
            drafts = parse_nmap_bytes(data, filename)
            parser_engine = "gateway"
        else:
            drafts = parse_nessus_csv_bytes(data)
            parser_engine = "gateway"

        if not drafts:
            update_ingest_job(
                job_id,
                status=IngestJobStatus.failed.value,
                error="no rows parsed",
                progress_pct=100,
            )
            return

        apply_asset_scope_to_drafts(
            drafts,
            asset_group=params.get("asset_group"),
            asset_subgroup=params.get("asset_subgroup"),
        )

        update_ingest_job(
            job_id,
            status=IngestJobStatus.enriching.value,
            progress_pct=40,
            parser_engine=parser_engine,
        )

        bulk = len(drafts) > 2000
        if kind == IngestJobKind.nessus_rescan.value:
            fast_rescan = len(drafts) > 1000
            if not fast_rescan:
                enrich_drafts_with_catalog(db, drafts, tenant_id=tenant_id)
                ensure_drafts_catalog(db, drafts)
            scan_run = ScanRun(
                tenant_id=tenant_id,
                engagement_id=engagement_id,
                tool_source="Nessus",
                label=params.get("label") or filename,
                file_name=filename,
                scope=params.get("scope", "tenant"),
                absent_policy=params.get("absent_policy", "atendido"),
            )
            db.add(scan_run)
            db.flush()
            stats = apply_nessus_rescan(
                db,
                drafts=drafts,
                tenant_id=tenant_id,
                engagement_id=engagement_id,
                scope=params.get("scope", "tenant"),
                absent_policy=params.get("absent_policy", "atendido"),
                scan_run=scan_run,
                actor=job.get("actor") or "system",
                fast_rescan=fast_rescan,
            )
            scope_val = params.get("scope", "tenant")
            absent_val = params.get("absent_policy", "atendido")
            parts = [
                f"{stats['new_count']} nuevas",
                f"{stats['updated_count']} actualizadas",
                f"{stats['reaparecido_count']} reaparecidas",
                f"{stats['absent_count']} ausentes → {absent_val}",
            ]
            result_payload = {
                **stats,
                "scan_run_id": str(scan_run.id),
                "scope": scope_val,
                "absent_policy": absent_val,
                "message": " · ".join(parts),
            }
            update_ingest_job(
                job_id,
                status=IngestJobStatus.completed.value,
                progress_pct=100,
                completed_at=datetime.now(timezone.utc).isoformat(),
                result=result_payload,
                message=result_payload["message"],
            )
            return

        catalog_hits = enrich_drafts_with_catalog(db, drafts, tenant_id=tenant_id)
        catalog_stats = ensure_drafts_catalog(db, drafts, fast_mode=bulk)

        update_ingest_job(job_id, status=IngestJobStatus.persisting.value, progress_pct=70)

        from app.routers.ingest import _persist_drafts, _refresh_asset_targets_after_ingest

        ids = _persist_drafts(
            db,
            drafts,
            engagement_id,
            tenant_id,
            fast_bulk=bulk,
        )
        if not bulk:
            _refresh_asset_targets_after_ingest(db, engagement_id, tenant_id)

        update_ingest_job(
            job_id,
            status=IngestJobStatus.completed.value,
            progress_pct=100,
            completed_at=datetime.now(timezone.utc).isoformat(),
            result={
                "created_count": len(ids) if ids else len(drafts),
                "catalog_hits": catalog_hits,
                "catalog_stats": catalog_stats,
            },
            message=f"{len(drafts):,} rows imported",
        )
    except Exception as exc:
        db.rollback()
        update_ingest_job(
            job_id,
            status=IngestJobStatus.failed.value,
            error=str(exc),
            progress_pct=100,
        )
        raise
    finally:
        db.close()
