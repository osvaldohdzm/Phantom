"""Exporta core.vulns_catalog al bundle versionado en backend/catalog/."""

from __future__ import annotations

import argparse
import sys

from app.database import SessionLocal
from app.services.catalog_bundle import (
    export_catalog_to_bundle,
    load_manifest,
    resolve_export_notes,
    resolve_export_revision,
    resolve_export_version,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export operational catalog to backend/catalog/ (sobrescribe operational-catalog.* + manifest.json)",
    )
    parser.add_argument(
        "version",
        nargs="?",
        default=None,
        help="Versión legible (opcional; por defecto: manifest.version o vAAAA.MM.DD)",
    )
    parser.add_argument(
        "--revision",
        type=int,
        default=None,
        help="Revisión incremental (por defecto: manifest.revision + 1)",
    )
    parser.add_argument(
        "--notes",
        default=None,
        help="Nota en manifest.json (por defecto: texto de corte operativo)",
    )
    parser.add_argument(
        "--no-gzip",
        action="store_true",
        help="Escribir operational-catalog.csv sin comprimir",
    )
    args = parser.parse_args()

    version = resolve_export_version(args.version)
    revision = resolve_export_revision(args.revision)
    notes = resolve_export_notes(args.notes, version=version, revision=revision)

    db = SessionLocal()
    try:
        result = export_catalog_to_bundle(
            db,
            version=version,
            revision=revision,
            notes=notes,
            gzip_output=not args.no_gzip,
        )
    except Exception as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

    print(f"Exported {result['row_count']:,} rows → {result['path']}")
    print(f"Manifest: {result['manifest']}")
    print(f"version={result['version']} revision={result['revision']} sha256={result['sha256']}")
    print("Next: git add backend/catalog/ && git commit && git push")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
