"""Índice de catálogo por herramienta — equivalente a CHOOSE/SWITCH de Excel CFR."""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.core import Finding
from app.services.text_encoding import extract_nessus_plugin_id
from app.services.vulns_catalog_schema import (
    catalog_column_available,
    rollback_db_on_error,
    vulns_catalog_lookup_select_clause,
    vulns_catalog_table_columns,
)

# Tipo de origen → columna en core.vulns_catalog (Tbl_Catalogo_vulnerabilidades)
TOOL_SOURCE_CATALOG_COLUMNS: dict[str, str] = {
    "nessus": "NessusPluginId",
    "invicti": "InvictiName",
    "vulnerabilitymanagerplus": "VulnerabilityManagerPlusName",
    "sonarqube": "SonarRuleId",
    "derscanner": "DerScannerName",
    "roslynator": "RoslynatorId",
    "owaspzap": "OWASPZAPScanRuleId",
    "acunetix": "AcunetixName",
    "openvas": "OpenVasNVTId",
    "nexpose": "NexposeName",
    "insightappsec": "InsightAppSecInsightAppSec",
    "nmap": "NmapScriptName",
    "fortify": "FortifyName",
    "manual": "StandardVulnerabilityName",
}


def _catalog_select(db: Session) -> str:
    return vulns_catalog_lookup_select_clause(db)

_PLUGIN_IN_TEXT_RE = re.compile(r"plugin(?:\s+ID)?[:\s]+(\d+)", re.IGNORECASE)
_NMAP_SCRIPT_RE = re.compile(r"\[Nmap[^\]]*\]\s*(.+)", re.IGNORECASE)


def normalize_tool_source(raw: Optional[str]) -> str:
    key = (raw or "Manual").strip().casefold().replace(" ", "").replace("_", "").replace("-", "")
    aliases = {
        "owasp": "owaspzap",
        "zap": "owaspzap",
        "openvas": "openvas",
        "vmplus": "vulnerabilitymanagerplus",
        "vmp": "vulnerabilitymanagerplus",
        "sonar": "sonarqube",
        "tenable": "nessus",
    }
    return aliases.get(key, key) if key in aliases else (key or "manual")


def catalog_column_for_source(source_type: Optional[str]) -> Optional[str]:
    return TOOL_SOURCE_CATALOG_COLUMNS.get(normalize_tool_source(source_type))


def resolve_finding_tool_identity(finding: Finding) -> tuple[str, str]:
    """Devuelve (tipo_origen, identificador_original) para indexar catálogo."""
    src = normalize_tool_source(getattr(finding, "tool_source", None))
    vid = (getattr(finding, "tool_vuln_id", None) or "").strip()
    if vid:
        return src, vid

    raw = finding.raw_tool_output or ""
    pid = extract_nessus_plugin_id(raw)
    if pid:
        return "nessus", pid
    for match in _PLUGIN_IN_TEXT_RE.finditer(raw):
        return "nessus", match.group(1)

    if "[nmap" in raw.casefold():
        m = _NMAP_SCRIPT_RE.search(raw)
        if m:
            return "nmap", m.group(1).strip()[:255]

    if "[acunetix" in raw.casefold():
        title = (finding.titulo or "").strip()
        if title:
            return "acunetix", title[:255]

    title = (finding.titulo or "").strip()
    if title:
        return "manual", title[:255]
    return "manual", ""


def ensure_finding_tool_identity(finding: Finding) -> None:
    """Persiste tool_source/tool_vuln_id en el hallazgo si faltan (inferidos del raw)."""
    if (getattr(finding, "tool_vuln_id", None) or "").strip():
        return
    src, vid = resolve_finding_tool_identity(finding)
    if not vid:
        return
    if hasattr(finding, "tool_source"):
        finding.tool_source = src
    if hasattr(finding, "tool_vuln_id"):
        finding.tool_vuln_id = vid


class CatalogIngestCache:
    """Cache en memoria por lote de ingesta (evita N consultas SQL por fila)."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._hits: dict[tuple[str, str], Optional[dict]] = {}

    def lookup(self, source_type: str, original_id: str) -> Optional[dict]:
        src = normalize_tool_source(source_type)
        oid = (original_id or "").strip()
        if not oid:
            return None
        key = (src, oid)
        if key not in self._hits:
            self._hits[key] = lookup_catalog_by_tool_index(self.db, src, oid)
        return self._hits[key]

    def preload_catalog_batch(
        self,
        source_type: str,
        original_ids: list[str],
        *,
        batch_size: int = 500,
    ) -> None:
        """Precarga filas de catálogo con WHERE col = ANY(:oids) en lotes."""
        src = normalize_tool_source(source_type)
        col = catalog_column_for_source(src)
        if not col or col not in TOOL_SOURCE_CATALOG_COLUMNS.values():
            return

        pending: list[str] = []
        seen: set[str] = set()
        for raw in original_ids:
            oid = (raw or "").strip()
            if not oid or oid in seen:
                continue
            seen.add(oid)
            if (src, oid) not in self._hits:
                pending.append(oid)

        if not pending:
            return

        if not catalog_column_available(self.db, col):
            for oid in pending:
                self._hits[(src, oid)] = None
            return

        for offset in range(0, len(pending), batch_size):
            batch = pending[offset : offset + batch_size]
            if not batch:
                continue
            try:
                rows = self.db.execute(
                    text(
                        f"""
                        SELECT {_catalog_select(self.db)}
                        FROM core.vulns_catalog
                        WHERE TRIM("{col}"::text) = ANY(:oids)
                        """
                    ),
                    {"oids": batch},
                ).mappings().all()
                found: dict[str, dict] = {}
                for row in rows:
                    oid_val = str(row.get(col) or "").strip()
                    if oid_val:
                        found[oid_val] = dict(row)
                for oid in batch:
                    self._hits[(src, oid)] = found.get(oid)
            except Exception:
                rollback_db_on_error(self.db)
                for oid in batch:
                    key = (src, oid)
                    if key not in self._hits:
                        self._hits[key] = lookup_catalog_by_tool_index(self.db, src, oid)

    def preload(self, source_type: str, original_ids: list[str], *, batch_size: int = 500) -> None:
        """Alias de preload_catalog_batch."""
        self.preload_catalog_batch(source_type, original_ids, batch_size=batch_size)


def lookup_catalog_by_tool_index(
    db: Session,
    source_type: str,
    original_id: str,
) -> Optional[dict]:
    """MATCH(identificador_original, columna_herramienta) como en Excel."""
    col = catalog_column_for_source(source_type)
    oid = (original_id or "").strip()
    if not col or not oid:
        return None
    if col not in TOOL_SOURCE_CATALOG_COLUMNS.values():
        return None
    if not catalog_column_available(db, col):
        return None
    if not vulns_catalog_table_columns(db):
        return None
    try:
        row = db.execute(
            text(
                f"""
                SELECT {_catalog_select(db)}
                FROM core.vulns_catalog
                WHERE TRIM("{col}"::text) = :oid
                LIMIT 1
                """
            ),
            {"oid": oid},
        ).mappings().first()
        return dict(row) if row else None
    except Exception:
        rollback_db_on_error(db)
        return None


def finding_matches_catalog_row(finding: Finding, cat: dict) -> bool:
    src, vid = resolve_finding_tool_identity(finding)
    if not vid:
        return False
    col = catalog_column_for_source(src)
    if not col:
        return False
    cat_val = str(cat.get(col) or "").strip()
    return cat_val == vid
