#!/usr/bin/env bash
# Phantom — reiniciar stack Docker.
# Uso: ./restart.sh
#      ./restart.sh api web
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

phantom_require_compose

if [[ $# -gt 0 ]]; then
  echo "[*] Reiniciando: $*"
  phantom_compose restart "$@"
else
  echo "[*] Reiniciando todos los servicios…"
  phantom_compose restart
fi

phantom_load_env
sleep 2
if curl -kfsS "https://127.0.0.1:${PHANTOM_HTTP_PORT}/" -o /dev/null 2>/dev/null; then
  echo "[+] Phantom reiniciado"
  phantom_print_urls
else
  echo "[!] Reinicio completado pero el web no responde aún. Usa: ./healthcheck.sh"
fi
