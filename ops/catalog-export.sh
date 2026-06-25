#!/usr/bin/env bash
# Exporta core.vulns_catalog → backend/catalog/ (sobrescribe última versión).
#
# Docker (servidor):
#   ./catalog-export.sh
#   ./catalog-export.sh v2026.06.1
#
# Postgres local en macOS / sin Docker:
#   ./catalog-export.sh --native
#   ./phantom catalog-export --native
#
# Opcional: --revision N  --notes "texto"
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

USE_NATIVE=0
PY_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --native|-n) USE_NATIVE=1 ;;
    *) PY_ARGS+=("$arg") ;;
  esac
done

phantom_cd_root

if [[ "$USE_NATIVE" -eq 1 ]]; then
  phantom_catalog_export_native "${PY_ARGS[@]+"${PY_ARGS[@]}"}"
  exit 0
fi

if ! phantom_has_compose; then
  echo "[!] Docker Compose no disponible en este equipo." >&2
  echo "    Postgres local: ./phantom catalog-export --native" >&2
  echo "    (requiere DATABASE_URL en backend/.env)" >&2
  exit 1
fi

phantom_require_compose

if ! phantom_compose ps --status running api 2>/dev/null | grep -q api; then
  echo "[!] El contenedor api no está en marcha." >&2
  echo "    Docker: ./phantom start" >&2
  echo "    O nativo: ./phantom catalog-export --native" >&2
  exit 1
fi

echo "[*] Exportando catálogo operativo → backend/catalog/ (contenedor api) …"
phantom_compose exec -T api python -m scripts.export_operational_catalog "${PY_ARGS[@]}"
