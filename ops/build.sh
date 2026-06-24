#!/usr/bin/env bash
# Phantom — construir imágenes Docker.
# Uso: ./build.sh
#      ./build.sh --no-cache
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

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
echo "[+] Build completado. Arranca con: ./phantom start"
