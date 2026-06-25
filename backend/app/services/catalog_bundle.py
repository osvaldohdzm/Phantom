"""Catálogo operativo empaquetado en el repo (backend/catalog/) y seed en arranque."""

from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.vulns_catalog_schema import invalidate_vulns_catalog_schema_cache

CATALOG_DIR = Path(__file__).resolve().parents[2] / "catalog"
MANIFEST_PATH = CATALOG_DIR / "manifest.json"

DEFAULT_EXPORT_NOTES = (
    "Corte operativo exportado desde core.vulns_catalog (snapshot de la BD actual)."
)

_PLACEHOLDER_VERSIONS = frozenset({"", "0.0.0", "unknown", "none"})

# Columnas conocidas del CFR / Excel operativo (el resto se añade al importar CSV).
_KNOWN_COLUMN_TYPES: dict[str, str] = {
    "Id": "INTEGER PRIMARY KEY",
    "StandardVulnerabilityName": "TEXT",
    "Vulnerability": "TEXT",
    "Severity": "VARCHAR(64)",
    "SourceDetection": "VARCHAR(128)",
    "Description": "TEXT",
    "Danger": "TEXT",
    "Solution": "TEXT",
    "References": "TEXT",
    "CVE": "VARCHAR(64)",
    "CWE": "VARCHAR(64)",
    "CVSSOverallScore3_1": "DOUBLE PRECISION",
    "CVSSVector3_1": "VARCHAR(128)",
    "CVSSBaseScore3_1": "DOUBLE PRECISION",
    "NessusPluginId": "VARCHAR(64)",
    "InvictiName": "TEXT",
    "VulnerabilityManagerPlusName": "TEXT",
    "SonarRuleId": "TEXT",
    "DerScannerName": "TEXT",
    "RoslynatorId": "TEXT",
    "OWASPZAPScanRuleId": "TEXT",
    "AcunetixName": "TEXT",
    "OpenVasNVTId": "TEXT",
    "NexposeName": "TEXT",
    "InsightAppSecInsightAppSec": "TEXT",
    "NmapScriptName": "TEXT",
    "FortifyName": "TEXT",
    "EspNombreVulnerabilidadUnificado": "TEXT",
    "EspSeveridadUnificada": "VARCHAR(64)",
    "EspDescripcionUnificada": "TEXT",
    "EspAmenazaUnificadaGeneral": "TEXT",
    "EspAmenazaUnificadaDesdeInternet": "TEXT",
    "EspPropuestaRemediacionUnificada": "TEXT",
    "EspPropuestaRemediacionUnificadaEnRedPrivada": "TEXT",
    "EspMetodoDeteccion": "TEXT",
    "EspExplicacionTecnica": "TEXT",
}

_BATCH_SIZE = 500


def load_manifest() -> Optional[dict[str, Any]]:
    if not MANIFEST_PATH.is_file():
        return None
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def resolve_export_version(explicit: Optional[str]) -> str:
    """Versión del bundle: argumento CLI, manifest existente o fecha UTC."""
    if explicit and str(explicit).strip():
        return str(explicit).strip()
    manifest = load_manifest() or {}
    current = str(manifest.get("version") or "").strip()
    if current.lower() not in _PLACEHOLDER_VERSIONS:
        return current
    return f"v{datetime.now(timezone.utc).strftime('%Y.%m.%d')}"


def resolve_export_revision(explicit: Optional[int]) -> int:
    """Revisión incremental por defecto (continuidad enumerada)."""
    if explicit is not None:
        return max(0, int(explicit))
    manifest = load_manifest() or {}
    return int(manifest.get("revision") or 0) + 1


def resolve_export_notes(
    explicit: Optional[str],
    *,
    version: str,
    revision: int,
) -> str:
    if explicit is not None and str(explicit).strip():
        return str(explicit).strip()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (
        f"{DEFAULT_EXPORT_NOTES} "
        f"Versión {version}, revisión {revision} ({stamp})."
    )


def bundled_catalog_path(manifest: Optional[dict[str, Any]] = None) -> Optional[Path]:
    manifest = manifest or load_manifest()
    if not manifest:
        return None
    filename = str(manifest.get("filename") or "").strip()
    if not filename:
        return None
    path = CATALOG_DIR / filename
    return path if path.is_file() else None


def _version_key(raw: str) -> tuple:
    s = (raw or "").strip().lower()
    if s.startswith("v"):
        s = s[1:]
    parts: list[Any] = []
    for chunk in re.split(r"[.\-_]+", s):
        if not chunk:
            continue
        if chunk.isdigit():
            parts.append(int(chunk))
        else:
            parts.append(chunk)
    return tuple(parts) if parts else ("",)


def bundled_is_newer(installed_version: str, bundled_version: str) -> bool:
    if not bundled_version:
        return False
    if not installed_version or installed_version in ("unknown", "0", "0.0.0"):
        return True
    return _version_key(bundled_version) > _version_key(installed_version)


def ensure_catalog_meta_table(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS core.vulns_catalog_meta (
              id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
              version text NOT NULL DEFAULT 'unknown',
              imported_at timestamptz,
              source_filename text,
              row_count integer NOT NULL DEFAULT 0,
              field_config_json jsonb,
              bundled_revision integer NOT NULL DEFAULT 0
            )
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE core.vulns_catalog_meta
            ADD COLUMN IF NOT EXISTS bundled_revision integer NOT NULL DEFAULT 0
            """
        )
    )
    db.execute(
        text(
            """
            INSERT INTO core.vulns_catalog_meta (id, version)
            VALUES (1, 'unknown')
            ON CONFLICT (id) DO NOTHING
            """
        )
    )
    db.commit()


def ensure_vulns_catalog_table(db: Session) -> None:
    db.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS core.vulns_catalog (
              "Id" INTEGER PRIMARY KEY
            )
            """
        )
    )
    for col, col_type in _KNOWN_COLUMN_TYPES.items():
        if col == "Id":
            continue
        db.execute(
            text(
                f'ALTER TABLE core.vulns_catalog ADD COLUMN IF NOT EXISTS "{col}" {col_type}'
            )
        )
    db.commit()
    invalidate_vulns_catalog_schema_cache()


def _read_catalog_bytes(path: Path) -> bytes:
    if path.suffix == ".gz" or path.name.endswith(".csv.gz"):
        with gzip.open(path, "rb") as fh:
            return fh.read()
    return path.read_bytes()


def _decode_csv_text(raw: bytes, encoding: str = "utf-8") -> str:
    for enc in (encoding, "utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _ensure_dynamic_columns(db: Session, headers: list[str]) -> None:
    existing = {
        str(r["column_name"])
        for r in db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
                """
            )
        ).mappings()
    }
    for header in headers:
        if header == "Id" or header in existing:
            continue
        db.execute(
            text(f'ALTER TABLE core.vulns_catalog ADD COLUMN IF NOT EXISTS "{header}" TEXT')
        )
    db.commit()
    invalidate_vulns_catalog_schema_cache()


def _empty_row(row: dict[str, str]) -> bool:
    return not any(str(v or "").strip() for v in row.values())


def import_catalog_csv_bytes(
    db: Session,
    raw: bytes,
    *,
    encoding: str = "utf-8",
    replace_all: bool = True,
    source_filename: str = "bundled",
) -> dict[str, Any]:
    """Importa CSV (bytes) a core.vulns_catalog."""
    ensure_vulns_catalog_table(db)
    text_csv = _decode_csv_text(raw, encoding)
    reader = csv.DictReader(io.StringIO(text_csv))
    if not reader.fieldnames:
        return {"imported": 0, "skipped": 0, "error": "CSV sin cabeceras"}

    headers = [h.strip() for h in reader.fieldnames if h and h.strip()]
    _ensure_dynamic_columns(db, headers)

    table_cols = {
        str(r["column_name"])
        for r in db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
                """
            )
        ).mappings()
    }
    upsert_cols = [h for h in headers if h in table_cols]
    has_id = "Id" in upsert_cols
    update_set = ", ".join(
        f'"{c}" = EXCLUDED."{c}"' for c in upsert_cols if c != "Id"
    )

    if replace_all:
        db.execute(text("TRUNCATE TABLE core.vulns_catalog"))
        db.commit()

    imported = 0
    skipped = 0
    batch: list[dict[str, str]] = []

    def flush_batch() -> None:
        nonlocal imported, skipped
        if not batch:
            return
        for row in batch:
            if _empty_row(row):
                skipped += 1
                continue
            cols: list[str] = []
            values: dict[str, Any] = {}
            for col in upsert_cols:
                if col not in row:
                    continue
                raw_val = row[col]
                if raw_val is None or str(raw_val).strip() == "":
                    if col == "Id":
                        continue
                    cols.append(f'"{col}"')
                    values[col] = None
                    continue
                cols.append(f'"{col}"')
                values[col] = str(raw_val).strip()
            if not cols:
                skipped += 1
                continue
            placeholders = ", ".join(f":{c}" for c in values)
            col_sql = ", ".join(cols)
            id_val = str(row.get("Id") or "").strip()
            if has_id and id_val and update_set and not replace_all:
                db.execute(
                    text(
                        f"""
                        INSERT INTO core.vulns_catalog ({col_sql})
                        VALUES ({placeholders})
                        ON CONFLICT ("Id") DO UPDATE SET {update_set}
                        """
                    ),
                    values,
                )
            else:
                db.execute(
                    text(
                        f"INSERT INTO core.vulns_catalog ({col_sql}) VALUES ({placeholders})"
                    ),
                    values,
                )
            imported += 1
        db.commit()
        batch.clear()

    for row in reader:
        batch.append({k: (v or "") for k, v in row.items() if k})
        if len(batch) >= _BATCH_SIZE:
            flush_batch()
    flush_batch()

    count = db.execute(
        text("SELECT COUNT(*)::int AS n FROM core.vulns_catalog")
    ).mappings().first()
    row_count = int(count["n"] if count else imported)

    return {
        "imported": imported,
        "skipped": skipped,
        "row_count": row_count,
        "source_filename": source_filename,
        "columns": len(upsert_cols),
    }


def import_bundled_catalog(
    db: Session,
    *,
    force: bool = False,
    replace_all: bool = True,
) -> dict[str, Any]:
    manifest = load_manifest()
    path = bundled_catalog_path(manifest)
    if not manifest or not path:
        return {"status": "skipped", "reason": "no_bundled_catalog"}

    ensure_vulns_catalog_table(db)
    ensure_catalog_meta_table(db)
    meta = db.execute(
        text(
            """
            SELECT version, bundled_revision, row_count
            FROM core.vulns_catalog_meta WHERE id = 1
            """
        )
    ).mappings().first()

    installed_version = str(meta["version"] if meta else "unknown")
    installed_revision = int(meta["bundled_revision"] if meta and meta["bundled_revision"] else 0)
    bundled_version = str(manifest.get("version") or "unknown")
    bundled_revision = int(manifest.get("revision") or 0)
    bundled_sha = str(manifest.get("sha256") or "").strip().lower()

    current_rows = db.execute(
        text("SELECT COUNT(*)::int AS n FROM core.vulns_catalog")
    ).mappings().first()
    row_count_now = int(current_rows["n"] if current_rows else 0)

    needs_import = force
    if not needs_import and bundled_revision > 0 and bundled_revision > installed_revision:
        needs_import = True
    if not needs_import and bundled_is_newer(installed_version, bundled_version):
        needs_import = True
    if not needs_import and row_count_now == 0:
        needs_import = True

    if not needs_import:
        return {
            "status": "skipped",
            "reason": "already_current",
            "installed_version": installed_version,
            "bundled_version": bundled_version,
        }

    raw = _read_catalog_bytes(path)
    if bundled_sha:
        digest = hashlib.sha256(raw).hexdigest()
        if digest != bundled_sha:
            return {
                "status": "error",
                "reason": "sha256_mismatch",
                "expected": bundled_sha,
                "actual": digest,
            }

    encoding = str(manifest.get("encoding") or "utf-8")
    stats = import_catalog_csv_bytes(
        db,
        raw,
        encoding=encoding,
        replace_all=replace_all,
        source_filename=path.name,
    )

    db.execute(
        text(
            """
            UPDATE core.vulns_catalog_meta
            SET version = :version,
                imported_at = :imported_at,
                source_filename = :source_filename,
                row_count = :row_count,
                bundled_revision = :revision
            WHERE id = 1
            """
        ),
        {
            "version": bundled_version,
            "imported_at": datetime.now(timezone.utc),
            "source_filename": path.name,
            "row_count": stats["row_count"],
            "revision": bundled_revision,
        },
    )
    db.commit()
    invalidate_vulns_catalog_schema_cache()

    return {
        "status": "imported",
        "version": bundled_version,
        "revision": bundled_revision,
        **stats,
    }


def seed_operational_catalog_if_needed(db: Session) -> dict[str, Any]:
    if os.environ.get("PHANTOM_SKIP_CATALOG_SEED", "").strip().lower() in ("1", "true", "yes"):
        return {"status": "skipped", "reason": "env_skip"}
    force = os.environ.get("PHANTOM_CATALOG_FORCE_IMPORT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    try:
        ensure_vulns_catalog_table(db)
        ensure_catalog_meta_table(db)
        result = import_bundled_catalog(db, force=force)
        if result.get("status") == "imported":
            print(
                f"Operational catalog seeded: {result.get('version')} "
                f"({result.get('row_count', 0):,} rows)"
            )
        return result
    except Exception as exc:
        db.rollback()
        print(f"Operational catalog seed skipped: {exc}")
        return {"status": "error", "error": str(exc)}


def export_catalog_to_bundle(
    db: Session,
    *,
    version: str,
    revision: int,
    notes: str = "",
    gzip_output: bool = True,
) -> dict[str, Any]:
    """Exporta core.vulns_catalog → backend/catalog/ y actualiza manifest.json."""
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)

    cols = [
        str(r["column_name"])
        for r in db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
                ORDER BY ordinal_position ASC
                """
            )
        ).mappings()
    ]
    if not cols:
        raise RuntimeError("core.vulns_catalog no existe o no tiene columnas")

    quoted = ", ".join(f'"{c}"' for c in cols)
    rows = db.execute(
        text(f'SELECT {quoted} FROM core.vulns_catalog ORDER BY "Id"::int ASC NULLS LAST')
    ).mappings().all()

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=cols, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({c: row.get(c) for c in cols})
    csv_bytes = buffer.getvalue().encode("utf-8")

    filename = "operational-catalog.csv.gz" if gzip_output else "operational-catalog.csv"
    out_path = CATALOG_DIR / filename
    if gzip_output:
        with gzip.open(out_path, "wb") as fh:
            fh.write(csv_bytes)
        payload_for_hash = out_path.read_bytes()
    else:
        out_path.write_bytes(csv_bytes)
        payload_for_hash = csv_bytes

    sha256 = hashlib.sha256(payload_for_hash).hexdigest()
    manifest = {
        "version": version,
        "revision": revision,
        "filename": filename,
        "encoding": "utf-8",
        "row_count": len(rows),
        "sha256": sha256,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "notes": notes,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # Un solo artefacto en repo: sobrescribir y eliminar el formato alternativo.
    stale_name = "operational-catalog.csv" if gzip_output else "operational-catalog.csv.gz"
    stale_path = CATALOG_DIR / stale_name
    if stale_path.exists():
        stale_path.unlink()

    return {
        "path": str(out_path),
        "manifest": str(MANIFEST_PATH),
        "row_count": len(rows),
        "sha256": sha256,
        "version": version,
        "revision": revision,
    }
