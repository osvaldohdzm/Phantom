"""Exporta core.vulns_catalog al bundle versionado en backend/catalog/."""

from __future__ import annotations

import argparse
import sys

from app.database import SessionLocal
from app.services.catalog_bundle import export_catalog_to_bundle, load_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Export operational catalog to backend/catalog/")
    parser.add_argument(
        "version",
        help="Versión legible, p. ej. v2026.06.1",
    )
    parser.add_argument(
        "--revision",
        type=int,
        default=None,
        help="Número de revisión (por defecto: manifest.revision + 1)",
    )
    parser.add_argument("--notes", default="", help="Nota breve para manifest.json")
    parser.add_argument(
        "--no-gzip",
        action="store_true",
        help="Escribir operational-catalog.csv sin comprimir",
    )
    args = parser.parse_args()

    manifest = load_manifest()
    revision = args.revision
    if revision is None:
        revision = int((manifest or {}).get("revision") or 0) + 1

    db = SessionLocal()
    try:
        result = export_catalog_to_bundle(
            db,
            version=args.version,
            revision=revision,
            notes=args.notes,
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
