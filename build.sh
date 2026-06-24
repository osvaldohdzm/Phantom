#!/usr/bin/env bash
# Phantom — construir imágenes Docker.
# Uso: ./build.sh
#      ./build.sh --no-cache
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

phantom_ensure_env_file
phantom_require_compose

NO_CACHE=()
if [[ "${1:-}" == "--no-cache" ]]; then
  NO_CACHE=(--no-cache)
  echo "[*] Build sin caché…"
else
  echo "[*] Construyendo imágenes…"
fi

phantom_compose build "${NO_CACHE[@]}"
echo "[+] Build completado. Arranca con: ./start.sh"
