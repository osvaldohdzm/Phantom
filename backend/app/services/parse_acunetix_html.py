"""Parse Acunetix WVS HTML report (tablas de alertas) into finding drafts."""

from __future__ import annotations

import re
from html import unescape
from typing import Any, Optional

from bs4 import BeautifulSoup

from app.services.ingest_common import clamp_title, map_scanner_severity


def _clean_cell(s: str) -> str:
    return unescape(re.sub(r"\s+", " ", (s or "").strip()))


def _header_cells(tr) -> list[str]:
    cells = tr.find_all(["th", "td"])
    return [_clean_cell(c.get_text()) for c in cells]


def _row_cells(tr) -> list[str]:
    cells = tr.find_all("td")
    return [_clean_cell(c.get_text()) for c in cells]


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


def _pick_columns(headers: list[str]) -> dict[str, int]:
    """Map logical field → column index."""
    idx: dict[str, int] = {}
    for i, h in enumerate(headers):
        n = _norm(h)
        if "severity" in n or n == "risk" or "riesgo" in n:
            idx.setdefault("severity", i)
        if (
            "vulnerability" in n
            or "plugin name" in n
            or n in ("alert", "name", "nombre", "title", "issue")
            or (n.startswith("issue") and len(n) < 32)
        ):
            idx.setdefault("title", i)
        if "url" in n or "affected" in n or "location" in n or "target" in n:
            idx.setdefault("url", i)
        if "description" in n or "details" in n or "detalle" in n or "summary" in n:
            idx.setdefault("desc", i)
        if "recommendation" in n or "solution" in n or "remediation" in n:
            idx.setdefault("solution", i)
        if "cvss" in n and "score" in n:
            idx.setdefault("cvss", i)
        if n == "cve" or "cve" in n:
            idx.setdefault("cve", i)
    return idx


def _cell(row: list[str], col: Optional[int]) -> str:
    if col is None or col < 0 or col >= len(row):
        return ""
    return row[col]


def parse_acunetix_html_bytes(data: bytes) -> list[dict[str, Any]]:
    html = data.decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    findings: list[dict[str, Any]] = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = _header_cells(rows[0])
        if not headers:
            continue
        cmap = _pick_columns(headers)
        if "title" not in cmap and "severity" not in cmap:
            continue

        for tr in rows[1:]:
            cells = _row_cells(tr)
            if len(cells) < max(cmap.values(), default=-1) + 1:
                continue
            title = _cell(cells, cmap.get("title")) or _cell(cells, 0)
            if not title or len(title) < 3:
                continue
            sev_txt = _cell(cells, cmap.get("severity"))
            url = _cell(cells, cmap.get("url"))
            desc = _cell(cells, cmap.get("desc"))
            sol = _cell(cells, cmap.get("solution"))
            cvss_s = _cell(cells, cmap.get("cvss"))
            cve = _cell(cells, cmap.get("cve"))

            body = "\n\n".join(p for p in (desc, sol) if p)
            if url:
                body = (f"URL / activo: {url}\n\n" + body).strip()
            if not body:
                body = "(Sin descripción en export HTML)"

            raw_parts = ["[Acunetix HTML]", f"URL: {url}" if url else None, f"Severidad export: {sev_txt}" if sev_txt else None]
            raw = "\n".join(p for p in raw_parts if p)

            cvss_val: Optional[float] = None
            if cvss_s:
                m = re.search(r"(\d+(?:\.\d+)?)", cvss_s.replace(",", "."))
                if m:
                    try:
                        cvss_val = float(m.group(1))
                    except ValueError:
                        pass

            findings.append(
                {
                    "titulo": clamp_title(title),
                    "descripcion": body[:32000],
                    "severidad": map_scanner_severity(sev_txt or None),
                    "cvss_score": cvss_val,
                    "cvss_vector": None,
                    "cve": (cve[:32] if cve else None),
                    "cwe": None,
                    "raw_tool_output": raw[:32000],
                }
            )

    return findings
