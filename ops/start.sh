#!/usr/bin/env bash
# Phantom — arrancar stack Docker en segundo plano.
# Uso: ./phantom start
#      PHANTOM_MODE=native ./phantom start   # modo nativo (HTTPS local, sin Docker)
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT

if [[ "${PHANTOM_MODE:-docker}" == "native" ]]; then
  exec "$OPS_DIR/native.sh"
fi

# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

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
