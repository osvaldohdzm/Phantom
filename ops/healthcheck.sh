#!/usr/bin/env bash
# Phantom — comprobar salud del stack.
# Uso: ./phantom health
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_load_env
FAIL=0

echo "============================================================"
echo " Phantom — healthcheck"
echo "============================================================"

if phantom_require_compose 2>/dev/null; then
  echo "[*] Contenedores:"
  phantom_compose ps
  echo ""
else
  echo "[!] Docker Compose no disponible"
  FAIL=1
fi

echo "[*] Web HTTPS (localhost:${PHANTOM_HTTP_PORT})…"
if curl -kfsS "https://127.0.0.1:${PHANTOM_HTTP_PORT}/" -o /dev/null 2>/dev/null; then
  echo "    OK — frontend responde"
else
  echo "    FAIL — frontend no responde"
  FAIL=1
fi

echo "[*] API (proxy /api/secops-health)…"
API_BODY=$(curl -kfsS "https://127.0.0.1:${PHANTOM_HTTP_PORT}/api/secops-health" 2>/dev/null || true)
if echo "$API_BODY" | grep -q '"status"'; then
  echo "    OK — $API_BODY"
else
  echo "    FAIL — API no alcanzable vía proxy"
  FAIL=1
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "[+] Salud: OK"
  phantom_print_urls
  exit 0
fi

echo "[!] Salud: PROBLEMAS DETECTADOS"
echo "    Diagnóstico: ./phantom logs"
exit 1
