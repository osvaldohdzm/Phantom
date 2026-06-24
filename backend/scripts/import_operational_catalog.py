"""Importa el catálogo empaquetado (backend/catalog/) a PostgreSQL."""

from __future__ import annotations

import argparse
import sys

from app.database import SessionLocal
from app.services.catalog_bundle import import_bundled_catalog, seed_operational_catalog_if_needed


def main() -> int:
    parser = argparse.ArgumentParser(description="Import bundled operational catalog")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reimportar aunque la versión instalada sea la misma",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Upsert por Id en lugar de TRUNCATE (solo con --force)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.force:
            result = import_bundled_catalog(
                db,
                force=True,
                replace_all=not args.merge,
            )
        else:
            result = seed_operational_catalog_if_needed(db)
    except Exception as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

    print(result)
    if result.get("status") == "error":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
