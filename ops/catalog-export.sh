#!/usr/bin/env bash
# Exporta core.vulns_catalog desde el stack Docker → backend/catalog/ (para commit).
# Uso: ./catalog-export.sh v2026.06.1
#      ./catalog-export.sh v2026.06.2 --revision 5 --notes "Nessus plugins Q2"
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Uso: $0 <version> [--revision N] [--notes texto]" >&2
  echo "Ejemplo: $0 v2026.06.1" >&2
  exit 1
fi
shift || true

phantom_cd_root
phantom_require_compose

if ! phantom_compose ps --status running api 2>/dev/null | grep -q api; then
  echo "[!] El contenedor api no está en marcha. Ejecuta: ./phantom start" >&2
  exit 1
fi

echo "[*] Exportando catálogo operativo → backend/catalog/ …"
phantom_compose exec -T api python -m scripts.export_operational_catalog "$VERSION" "$@"
