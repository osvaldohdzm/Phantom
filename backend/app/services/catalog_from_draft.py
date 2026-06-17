"""Resolver o crear entradas en core.vulns_catalog durante la ingesta."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.core import Severity
from app.services.catalog_tool_index import (
    CatalogIngestCache,
    catalog_column_for_source,
    lookup_catalog_by_tool_index,
    normalize_tool_source,
)
from app.services.text_encoding import extract_nessus_plugin_id, fix_text_encoding
from app.services.vulns_catalog_lookup import (
    _apply_catalog_to_draft,
    _extract_lookup_tokens,
    lookup_catalog_by_id,
    lookup_catalog_by_token,
)

_SEVERITY_ES: dict[str, str] = {
    "Critical": "Crítica",
    "High": "Alta",
    "Medium": "Media",
    "Low": "Baja",
    "Info": "Informativa",
}

_SOURCE_LABELS: dict[str, str] = {
    "nessus": "Nessus",
    "acunetix": "Acunetix",
    "nmap": "Nmap",
    "openvas": "OpenVAS",
    "manual": "Manual",
}


def _severity_value(sev: object) -> str:
    if isinstance(sev, Severity):
        return sev.value
    return str(sev or "Medium")


def _txt(value: object | None, max_len: int = 32000) -> Optional[str]:
    if value is None:
        return None
    s = fix_text_encoding(str(value).strip()) or str(value).strip()
    if not s:
        return None
    return s[:max_len]


class CatalogEnsureCache:
    """Cache de lookup + filas creadas en el mismo lote de ingesta."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.lookup = CatalogIngestCache(db)
        self._batch_created: dict[tuple[str, str], dict[str, Any]] = {}

    def remember(self, source: str, original_id: str, row: dict[str, Any]) -> None:
        src = normalize_tool_source(source)
        oid = (original_id or "").strip()
        if oid:
            self._batch_created[(src, oid)] = row

    def resolve(self, source: str, original_id: str) -> Optional[dict[str, Any]]:
        src = normalize_tool_source(source)
        oid = (original_id or "").strip()
        if not oid:
            return None
        key = (src, oid)
        if key in self._batch_created:
            return self._batch_created[key]
        return self.lookup.lookup(src, oid)


def draft_tool_identity(draft: dict[str, Any]) -> tuple[str, str]:
    src = normalize_tool_source(str(draft.get("tool_source") or "Nessus"))
    vid = str(draft.get("tool_vuln_id") or draft.get("nessus_plugin_id") or "").strip()
    if not vid and src == "nessus":
        vid = extract_nessus_plugin_id(draft.get("raw_tool_output")) or ""
    return src, vid


def draft_to_catalog_payload(draft: dict[str, Any]) -> dict[str, Optional[str]]:
    titulo = _txt(draft.get("titulo"), 512) or None
    sev_en = _severity_value(draft.get("severidad"))
    sev_es = _SEVERITY_ES.get(sev_en, "Media")
    src, vid = draft_tool_identity(draft)
    tool_col = catalog_column_for_source(src)
    plugin_id = extract_nessus_plugin_id(draft.get("raw_tool_output")) or (
        vid if src == "nessus" else None
    )

    descripcion = _txt(draft.get("descripcion"))
    metodo = _txt(draft.get("metodo_deteccion"))
    remediacion = _txt(draft.get("propuesta_remediacion"))
    amenaza = _txt(draft.get("amenaza_ampliada"))
    tecnica = _txt(draft.get("explicacion_tecnica"))

    payload: dict[str, Optional[str]] = {
        "StandardVulnerabilityName": titulo,
        "Vulnerability": titulo,
        "Severity": sev_en,
        "SourceDetection": _SOURCE_LABELS.get(src, src.title() or "Manual"),
        "Description": descripcion,
        "Danger": amenaza,
        "Solution": remediacion,
        "NessusPluginId": str(plugin_id).strip() if plugin_id else None,
        "CVE": _txt(draft.get("cve"), 64),
        "CWE": _txt(draft.get("cwe"), 64),
        "CVSSOverallScore3_1": (
            str(draft["cvss_score"]) if draft.get("cvss_score") is not None else None
        ),
        "EspNombreVulnerabilidadUnificado": titulo,
        "EspSeveridadUnificada": sev_es,
        "EspDescripcionUnificada": descripcion,
        "EspAmenazaUnificadaGeneral": amenaza,
        "EspPropuestaRemediacionUnificada": remediacion,
        "EspPropuestaRemediacionUnificadaEnRedPrivada": remediacion,
        "EspMetodoDeteccion": metodo,
        "EspExplicacionTecnica": tecnica,
    }

    if tool_col and vid and tool_col != "NessusPluginId":
        payload[tool_col] = vid[:255]
    elif tool_col == "StandardVulnerabilityName" and titulo:
        payload["StandardVulnerabilityName"] = titulo

    return payload


def _next_catalog_id(db: Session) -> str:
    row = db.execute(
        text('SELECT COALESCE(MAX("Id"::int), 0) + 1 AS next_id FROM core.vulns_catalog')
    ).mappings().first()
    return str(row["next_id"] if row else "1")


def _table_columns(db: Session) -> set[str]:
    rows = db.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
            """
        )
    ).mappings().all()
    return {str(r["column_name"]) for r in rows}


def insert_catalog_from_draft(db: Session, draft: dict[str, Any]) -> dict[str, Any]:
    payload = draft_to_catalog_payload(draft)
    table_cols = _table_columns(db)
    entries = {
        col: val
        for col, val in payload.items()
        if col in table_cols and val is not None and str(val).strip()
    }
    new_id = _next_catalog_id(db)
    cols = ['"Id"'] + [f'"{c}"' for c in entries]
    values = [new_id] + [fix_text_encoding(str(v)) for v in entries.values()]
    placeholders = ", ".join(f":p{i}" for i in range(len(values)))
    params = {f"p{i}": values[i] for i in range(len(values))}

    row = db.execute(
        text(
            f"""
            INSERT INTO core.vulns_catalog ({", ".join(cols)})
            VALUES ({placeholders})
            RETURNING "Id", "StandardVulnerabilityName", "NessusPluginId",
                      "EspNombreVulnerabilidadUnificado", "EspSeveridadUnificada",
                      "EspDescripcionUnificada", "EspAmenazaUnificadaGeneral",
                      "EspPropuestaRemediacionUnificadaEnRedPrivada",
                      "EspPropuestaRemediacionUnificada", "EspMetodoDeteccion",
                      "EspExplicacionTecnica", "References", "CVE", "CWE",
                      "CVSSOverallScore3_1", "CVSSVector3_1", "AcunetixName",
                      "NmapScriptName"
            """
        ),
        params,
    ).mappings().first()
    db.commit()
    return dict(row) if row else {"Id": new_id, **entries}


def merge_draft_into_catalog(
    db: Session,
    cat: dict[str, Any],
    draft: dict[str, Any],
) -> bool:
    """Rellena columnas vacías del catálogo con datos del escáner."""
    payload = draft_to_catalog_payload(draft)
    table_cols = _table_columns(db)
    updates: dict[str, str] = {}

    for col, val in payload.items():
        if col not in table_cols or not val or not str(val).strip():
            continue
        current = str(cat.get(col) or "").strip()
        if current:
            continue
        updates[col] = fix_text_encoding(str(val))

    if not updates:
        return False

    cid = str(cat.get("Id") or "").strip()
    if not cid:
        return False

    set_parts = [f'"{col}" = :{col}' for col in updates]
    db.execute(
        text(
            f"""
            UPDATE core.vulns_catalog
            SET {", ".join(set_parts)}
            WHERE TRIM("Id"::text) = :cid
            """
        ),
        {**updates, "cid": cid},
    )
    db.commit()
    cat.update(updates)
    return True


def _resolve_by_tokens(db: Session, draft: dict[str, Any]) -> Optional[dict[str, Any]]:
    for token in _extract_lookup_tokens(
        str(draft.get("titulo") or ""),
        draft.get("cve"),
        draft.get("raw_tool_output"),
    ):
        cat = lookup_catalog_by_token(db, token)
        if cat:
            return cat
    return None


def ensure_draft_catalog(
    db: Session,
    draft: dict[str, Any],
    cache: CatalogEnsureCache,
    *,
    create_if_missing: bool = True,
) -> str:
    """
    Vincula draft con catálogo operativo.
    Retorna: linked | created | merged | skipped
    """
    if draft.get("catalog_vulns_id"):
        return "linked"

    src, vid = draft_tool_identity(draft)
    cat: Optional[dict[str, Any]] = None

    if vid:
        cat = cache.resolve(src, vid)

    if not cat:
        cat = _resolve_by_tokens(db, draft)

    if cat:
        merged = merge_draft_into_catalog(db, cat, draft)
        _apply_catalog_to_draft(draft, cat)
        draft["catalog_vulns_id"] = cat.get("Id")
        if vid:
            cache.remember(src, vid, cat)
        return "merged" if merged else "linked"

    if not create_if_missing:
        return "skipped"

    if not vid and len(str(draft.get("titulo") or "").strip()) < 12:
        return "skipped"

    row = insert_catalog_from_draft(db, draft)
    _apply_catalog_to_draft(draft, row)
    draft["catalog_vulns_id"] = row.get("Id")
    if vid:
        cache.remember(src, vid, row)
    return "created"


def ensure_drafts_catalog(db: Session, drafts: list[dict[str, Any]]) -> dict[str, int]:
    """Asegura catálogo para todos los drafts (crear o enlazar + merge)."""
    cache = CatalogEnsureCache(db)
    stats = {"linked": 0, "created": 0, "merged": 0, "skipped": 0, "already": 0}

    for draft in drafts:
        existing_id = draft.get("catalog_vulns_id")
        if existing_id:
            cat = lookup_catalog_by_id(db, str(existing_id))
            if cat:
                if merge_draft_into_catalog(db, cat, draft):
                    stats["merged"] += 1
                _apply_catalog_to_draft(draft, cat)
            stats["already"] += 1
            continue
        result = ensure_draft_catalog(db, draft, cache)
        stats[result] = stats.get(result, 0) + 1

    return stats
