#!/usr/bin/env bash
# Phantom — arrancar stack (Docker o nativo en macOS sin Docker).
# Uso: ./phantom start
#      PHANTOM_MODE=docker ./phantom start   # forzar Docker
#      PHANTOM_MODE=native ./phantom start   # forzar nativo
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_load_env

if phantom_use_native_mode; then
  if [[ "${PHANTOM_MODE:-}" != "native" ]]; then
    echo "[*] macOS sin Docker — arranque nativo automático"
    echo "    Desarrollo: ./phantom dev   |   Docker: PHANTOM_MODE=docker ./phantom start"
    echo ""
  fi
  exec "$OPS_DIR/native.sh"
fi

echo "============================================================"
echo " Phantom — inicio (Docker)"
echo "============================================================"

phantom_ensure_env_file
phantom_generate_secrets_if_needed
phantom_ensure_tls_sans

"$OPS_DIR/verify-env.sh"

phantom_require_compose

echo "[*] Levantando servicios…"
phantom_compose up -d --build

echo "[*] Esperando servicio web…"
phantom_load_env
ok=0
for _ in $(seq 1 30); do
  if curl -kfsS "https://127.0.0.1:${PHANTOM_HTTP_PORT}/" -o /dev/null 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -eq 1 ]]; then
  echo "[+] Stack en ejecución"
  phantom_print_urls
  echo "    Logs: ./phantom logs"
  echo "    Estado: ./phantom health"
else
  echo "[!] El web aún no responde. Revisa: ./phantom logs web"
  phantom_compose ps
  exit 1
fi
