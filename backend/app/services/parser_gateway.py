"""Unified parser gateway: Rust → Go → Python fallback chain."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from app.config import settings
from app.models.core import Severity
from app.services import parser_clients
from app.services.parse_nessus_csv import (
    parse_nessus_csv_bytes as python_parse_nessus_csv,
    parse_nessus_scan_targets_csv_bytes as python_parse_nessus_targets,
)
from app.services.parse_nmap_scan import parse_nmap_bytes as python_parse_nmap

logger = logging.getLogger(__name__)

_SEVERITY_MAP = {
    "critical": Severity.critical,
    "high": Severity.high,
    "medium": Severity.medium,
    "low": Severity.low,
    "info": Severity.info,
}


def _normalize_drafts(drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Coerce external parser JSON into Python-native draft shapes."""
    out: list[dict[str, Any]] = []
    for d in drafts:
        row = dict(d)
        sev = row.get("severidad")
        if isinstance(sev, str):
            mapped = _SEVERITY_MAP.get(sev.strip().lower())
            if mapped is not None:
                row["severidad"] = mapped
        for key in ("first_seen", "last_seen"):
            val = row.get(key)
            if isinstance(val, str) and val.strip():
                try:
                    parsed = datetime.fromisoformat(val.replace("Z", "+00:00"))
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    row[key] = parsed
                except ValueError:
                    row.pop(key, None)
        comp = row.get("componente_afectado")
        if comp is not None and not comp:
            row["componente_afectado"] = None
        out.append(row)
    return out


def _try_chain(
    label: str,
    attempts: list[tuple[str, Callable[[], list[dict[str, Any]]]]],
    *,
    fallback: Callable[[], list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], str]:
    for engine, fn in attempts:
        try:
            drafts = _normalize_drafts(fn())
            logger.info("parse %s via %s (%s rows)", label, engine, len(drafts))
            return drafts, engine
        except Exception as exc:
            logger.warning("parse %s via %s failed: %s", label, engine, exc)
    drafts = fallback()
    logger.info("parse %s via python (%s rows)", label, len(drafts))
    return drafts, "python"


def parse_nessus_csv_bytes(data: bytes, encoding: Optional[str] = None) -> list[dict[str, Any]]:
    attempts: list[tuple[str, Callable[[], list[dict[str, Any]]]]] = []
    if settings.ingest_go_url:
        attempts.append(("go", lambda: parser_clients.go_parse_nessus_csv(data)))
    drafts, _ = _try_chain(
        "nessus-csv",
        attempts,
        fallback=lambda: python_parse_nessus_csv(data, encoding=encoding),
    )
    return drafts


def parse_nessus_scan_targets_csv_bytes(
    data: bytes,
    encoding: Optional[str] = None,
) -> list[dict[str, Any]]:
    attempts: list[tuple[str, Callable[[], list[dict[str, Any]]]]] = []
    if settings.parse_rust_url:
        attempts.append(("rust", lambda: parser_clients.rust_parse_nessus_targets(data)))
    if settings.ingest_go_url:
        attempts.append(("go", lambda: parser_clients.go_parse_nessus_targets(data)))
    drafts, _ = _try_chain(
        "nessus-targets",
        attempts,
        fallback=lambda: python_parse_nessus_targets(data, encoding=encoding),
    )
    return drafts


def parse_nmap_bytes(data: bytes, filename: str = "scan") -> list[dict[str, Any]]:
    attempts: list[tuple[str, Callable[[], list[dict[str, Any]]]]] = []
    if settings.ingest_go_url:
        attempts.append(("go", lambda: parser_clients.go_parse_nmap(data, filename)))
    drafts, _ = _try_chain(
        "nmap",
        attempts,
        fallback=lambda: python_parse_nmap(data, filename),
    )
    return drafts


def parser_stack_status() -> dict[str, Any]:
    return {
        "ingest_go_url": settings.ingest_go_url,
        "parse_rust_url": settings.parse_rust_url,
        "ingest_go_healthy": parser_clients.go_health_ok() if settings.ingest_go_url else None,
        "parse_rust_healthy": parser_clients.rust_health_ok() if settings.parse_rust_url else None,
        "fallback": "python",
    }
