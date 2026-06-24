"""Redis-backed async ingest jobs (large Nessus/Nmap uploads)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import redis

from app.config import settings

logger = logging.getLogger(__name__)

QUEUE_KEY = "phantom:ingest:queue"
JOB_KEY_PREFIX = "phantom:ingest:job:"
JOB_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


class IngestJobStatus(str, Enum):
    queued = "queued"
    parsing = "parsing"
    enriching = "enriching"
    persisting = "persisting"
    completed = "completed"
    failed = "failed"


class IngestJobKind(str, Enum):
    nessus_csv = "nessus-csv"
    nessus_rescan = "nessus-csv-rescan"
    nmap = "nmap"
    scan_targets = "scan-targets"


def _redis() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


def _storage_root() -> Path:
    root = Path(os.environ.get("PHANTOM_STORAGE_ROOT", "storage"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def _job_key(job_id: str) -> str:
    return f"{JOB_KEY_PREFIX}{job_id}"


def save_job_file(job_id: str, data: bytes, filename: str) -> Path:
    job_dir = _storage_root() / "ingest-jobs" / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    path = job_dir / (filename or "upload.bin")
    path.write_bytes(data)
    return path


def enqueue_ingest_job(
    *,
    kind: IngestJobKind,
    tenant_id: UUID,
    engagement_id: Optional[UUID],
    actor: str,
    filename: str,
    file_path: Path,
    file_sha256: str,
    file_size: int,
    params: Optional[dict[str, Any]] = None,
    job_id: Optional[str] = None,
) -> dict[str, Any]:
    job_id = job_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": job_id,
        "kind": kind.value,
        "status": IngestJobStatus.queued.value,
        "tenant_id": str(tenant_id),
        "engagement_id": str(engagement_id) if engagement_id else None,
        "actor": actor,
        "filename": filename,
        "file_path": str(file_path),
        "file_sha256": file_sha256,
        "file_size": file_size,
        "params": params or {},
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "completed_at": None,
        "progress_pct": 0,
        "message": None,
        "error": None,
        "result": None,
        "parser_engine": None,
    }
    r = _redis()
    r.set(_job_key(job_id), json.dumps(payload), ex=JOB_TTL_SECONDS)
    r.lpush(QUEUE_KEY, job_id)
    logger.info("enqueued ingest job %s kind=%s size=%s", job_id, kind.value, file_size)
    return payload


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get_ingest_job(job_id: str) -> Optional[dict[str, Any]]:
    raw = _redis().get(_job_key(job_id))
    if not raw:
        return None
    return json.loads(raw)


def update_ingest_job(job_id: str, **fields: Any) -> Optional[dict[str, Any]]:
    job = get_ingest_job(job_id)
    if not job:
        return None
    job.update(fields)
    job["updated_at"] = datetime.now(timezone.utc).isoformat()
    _redis().set(_job_key(job_id), json.dumps(job), ex=JOB_TTL_SECONDS)
    return job


def dequeue_ingest_job(timeout: int = 5) -> Optional[str]:
    item = _redis().brpop(QUEUE_KEY, timeout=timeout)
    if not item:
        return None
    return item[1]


def should_use_async_ingest(*, row_estimate: int = 0, file_size: int = 0) -> bool:
    if not settings.ingest_async_enabled:
        return False
    if file_size >= settings.ingest_async_min_bytes:
        return True
    if row_estimate >= settings.ingest_async_min_rows:
        return True
    return False
