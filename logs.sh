#!/usr/bin/env bash
# Phantom — ver logs Docker.
# Uso: ./logs.sh
#      ./logs.sh api
#      ./logs.sh web --tail 100
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

phantom_require_compose

if [[ $# -eq 0 ]]; then
  echo "[*] Logs (Ctrl+C para salir)…"
  phantom_compose logs -f
else
  phantom_compose logs -f "$@"
fi
