#!/usr/bin/env bash
# Phantom — ver logs Docker.
# Uso: ./phantom logs
#      ./phantom logs api
#      ./phantom logs web --tail 100
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_require_compose

if [[ $# -eq 0 ]]; then
  echo "[*] Logs (Ctrl+C para salir)…"
  phantom_compose logs -f
else
  phantom_compose logs -f "$@"
fi
