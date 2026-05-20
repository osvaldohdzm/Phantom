"""Helpers for scanner ingest → Finding rows."""

from __future__ import annotations

import re
from typing import Optional

from app.models.core import Severity


def clamp_title(s: str, max_len: int = 500) -> str:
    t = (s or "").strip().replace("\n", " ")
    if len(t) <= max_len:
        return t or "Sin título"
    return t[: max_len - 1].rstrip() + "…"


def map_scanner_severity(text: Optional[str]) -> Severity:
    if not text:
        return Severity.medium
    t = text.strip().lower()
    if any(x in t for x in ("critical", "critico", "crítico")):
        return Severity.critical
    if "high" in t or "alto" in t:
        return Severity.high
    if "medium" in t or "medio" in t or "moderate" in t:
        return Severity.medium
    if "low" in t or "bajo" in t:
        return Severity.low
    if "info" in t or "informational" in t or "informativ" in t or "best practice" in t:
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
