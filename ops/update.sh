#!/usr/bin/env bash
# Phantom — desplegar actualización (pull + build + restart).
# Uso: ./phantom update  |  ./deploy.sh (alias)
#      ./phantom update --no-pull
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

NO_PULL=0
if [[ "${1:-}" == "--no-pull" ]]; then
  NO_PULL=1
fi

echo "============================================================"
echo " Phantom — despliegue"
echo "============================================================"

phantom_cd_root

if [[ "$NO_PULL" -eq 0 ]] && git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "[*] git pull…"
  git pull --ff-only
else
  echo "[*] Omitiendo git pull"
fi

"$OPS_DIR/verify-env.sh"

echo "[*] Build…"
"$OPS_DIR/build.sh"

echo "[*] Recreando contenedores…"
phantom_require_compose
phantom_compose up -d --build --force-recreate

echo "[*] Comprobando salud…"
if "$OPS_DIR/healthcheck.sh"; then
  echo "[+] Despliegue completado"
  phantom_print_urls
else
  echo "[!] Despliegue terminado con advertencias — revisa logs"
  exit 1
fi
