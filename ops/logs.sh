#!/usr/bin/env bash
# Phantom — ver logs Docker (por defecto solo app: api + web).
# Uso: ./phantom logs
#      ./phantom logs api
#      ./phantom logs --all          # incluye postgres, redis
#      ./phantom logs web --tail 100
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_require_compose

MODE="app"
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --all)
      MODE="all"
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

if [[ ${#ARGS[@]} -eq 0 ]]; then
  if [[ "$MODE" == "all" ]]; then
    echo "[*] Logs completos (Ctrl+C para salir)…"
    phantom_compose logs -f
  else
    echo "[*] Logs api + web (Ctrl+C para salir). Postgres/redis: ./phantom logs --all"
    phantom_compose logs -f api web
  fi
else
  phantom_compose logs -f "${ARGS[@]}"
fi
