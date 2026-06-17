"""Helpers for scanner ingest → Finding rows."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional, Set

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.catalog_sql import catalog_table
from app.models.core import Severity

_VULN_TABLE = catalog_table("vulnerabilities")


def clamp_title(s: str, max_len: int = 500) -> str:
    t = (s or "").strip().replace("\n", " ")
    if len(t) <= max_len:
        return t or "Sin título"
    return t[: max_len - 1].rstrip() + "…"


def map_scanner_severity(text: Optional[str]) -> Severity:
    """Nessus/Tenable Risk: None, Low, Medium, High, Critical → Severity enum."""
    if not text:
        return Severity.info
    t = text.strip().lower()
    if t in ("none", "n/a", "na", "-", "0", "informational"):
        return Severity.info
    if any(x in t for x in ("critical", "critico", "crítico", "critica", "crítica")):
        return Severity.critical
    if t == "high" or t == "alta" or t == "alto" or (t.startswith("high") and "medium" not in t):
        return Severity.high
    if t in ("medium", "medio", "media", "moderate", "moderada"):
        return Severity.medium
    if "medium" in t or "medio" in t or "moderate" in t:
        return Severity.medium
    if t == "low" or t == "baja" or t == "bajo" or t.startswith("low"):
        return Severity.low
    if "info" in t or "informativ" in t or "best practice" in t:
        return Severity.info
    return Severity.medium


def parse_float_maybe(val: Optional[str]) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        m = re.search(r"(\d+(?:[.,]\d+)?)", s)
        if m:
            try:
                return float(m.group(1).replace(",", "."))
            except ValueError:
                return None
    return None


def parse_datetime_maybe(value: Optional[str]) -> Optional[datetime]:
    """Parsea fechas de exports Nessus/Seguimiento (YYYY-MM-DD, DD/MM/YYYY, etc.)."""
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def load_vulnerabilities_catalog_ids(db: Session) -> Set[int]:
    """IDs válidos en core.vulnerabilities (FK de findings.catalog_id)."""
    try:
        rows = db.execute(text(f'SELECT "Id" FROM {_VULN_TABLE}')).all()
        return {int(r[0]) for r in rows}
    except Exception:
        return set()


def resolve_finding_catalog_fk(
    raw_id: object,
    valid_ids: Optional[Set[int]] = None,
    *,
    db: Optional[Session] = None,
) -> Optional[int]:
    """
    findings.catalog_id → core.vulnerabilities.Id (no confundir con core.vulns_catalog).
    Durante ingesta, catalog_vulns_id suele ser de vulns_catalog; solo se persiste si existe en vulnerabilities.
    """
    if raw_id is None:
        return None
    try:
        cid = int(str(raw_id).strip())
    except (TypeError, ValueError):
        return None
    if cid <= 0:
        return None
    if valid_ids is not None:
        return cid if cid in valid_ids else None
    if db is None:
        return None
    row = db.execute(
        text(f'SELECT 1 FROM {_VULN_TABLE} WHERE "Id" = :cid LIMIT 1'),
        {"cid": cid},
    ).first()
    return cid if row else None
