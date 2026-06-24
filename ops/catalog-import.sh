#!/usr/bin/env bash
# Importa backend/catalog/ al PostgreSQL del stack (útil tras git pull).
# Uso: ./catalog-import.sh
#      ./catalog-import.sh --force
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_cd_root
phantom_require_compose

if ! phantom_compose ps --status running api 2>/dev/null | grep -q api; then
  echo "[!] El contenedor api no está en marcha. Ejecuta: ./phantom start" >&2
  exit 1
fi

echo "[*] Importando catálogo empaquetado…"
phantom_compose exec -T api python -m scripts.import_operational_catalog "$@"
