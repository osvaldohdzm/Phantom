"""HTTP clients for Go (phantom-ingest) and Rust (phantom-parse) parser services."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=5.0, read=600.0, write=120.0, pool=5.0)


def _post_bytes(url: str, data: bytes, *, params: Optional[dict[str, str]] = None) -> list[dict[str, Any]]:
    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(
            url,
            content=data,
            headers={"Content-Type": "application/octet-stream"},
            params=params or {},
        )
        resp.raise_for_status()
        payload = resp.json()
    drafts = payload.get("drafts")
    if not isinstance(drafts, list):
        raise ValueError("invalid parser response: missing drafts")
    engine = payload.get("engine", "unknown")
    count = payload.get("count", len(drafts))
    logger.info("parser %s returned %s drafts via %s", url, count, engine)
    return drafts


def go_parse_nessus_csv(data: bytes) -> list[dict[str, Any]]:
    base = (settings.ingest_go_url or "").rstrip("/")
    return _post_bytes(f"{base}/v1/parse/nessus-csv", data)


def go_parse_nessus_targets(data: bytes) -> list[dict[str, Any]]:
    base = (settings.ingest_go_url or "").rstrip("/")
    return _post_bytes(f"{base}/v1/parse/nessus-targets", data)


def go_parse_nmap(data: bytes, filename: str) -> list[dict[str, Any]]:
    base = (settings.ingest_go_url or "").rstrip("/")
    return _post_bytes(f"{base}/v1/parse/nmap", data, params={"filename": filename or "scan"})


def rust_parse_nessus_targets(data: bytes) -> list[dict[str, Any]]:
    base = (settings.parse_rust_url or "").rstrip("/")
    return _post_bytes(f"{base}/v1/parse/nessus-targets", data)


def rust_normalize_components(components: list[str]) -> list[str]:
    base = (settings.parse_rust_url or "").rstrip("/")
    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(
            f"{base}/v1/dedup/normalize-components",
            json={"components": components},
        )
        resp.raise_for_status()
        payload = resp.json()
    normalized = payload.get("normalized")
    if not isinstance(normalized, list):
        raise ValueError("invalid dedup response")
    return [str(x) for x in normalized]


def go_health_ok() -> bool:
    base = (settings.ingest_go_url or "").rstrip("/")
    if not base:
        return False
    try:
        with httpx.Client(timeout=httpx.Timeout(3.0)) as client:
            resp = client.get(f"{base}/health")
            return resp.status_code == 200
    except Exception:
        return False


def rust_health_ok() -> bool:
    base = (settings.parse_rust_url or "").rstrip("/")
    if not base:
        return False
    try:
        with httpx.Client(timeout=httpx.Timeout(3.0)) as client:
            resp = client.get(f"{base}/health")
            return resp.status_code == 200
    except Exception:
        return False
