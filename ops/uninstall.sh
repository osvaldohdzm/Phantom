#!/usr/bin/env bash
# Phantom — desinstalar aplicación (detiene servicios y limpia artefactos locales).
# Uso: ./phantom uninstall
#      ./phantom uninstall --volumes     # borra también BD y storage Docker
#      ./phantom uninstall --env         # borra .env
#      ./phantom uninstall --all         # volúmenes + .env + node_modules/.next/.venv
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

PURGE_VOLUMES=0
REMOVE_ENV=0
DEEP_CLEAN=0

for arg in "$@"; do
  case "$arg" in
    --volumes) PURGE_VOLUMES=1 ;;
    --env) REMOVE_ENV=1 ;;
    --all) PURGE_VOLUMES=1; REMOVE_ENV=1; DEEP_CLEAN=1 ;;
    -h|--help)
      echo "Uso: ./phantom uninstall [--volumes] [--env] [--all]"
      exit 0
      ;;
    *)
      echo "[!] Opción desconocida: $arg" >&2
      exit 1
      ;;
  esac
done

echo "============================================================"
echo " Phantom — desinstalación"
echo "============================================================"

if phantom_require_compose 2>/dev/null; then
  echo "[*] Deteniendo contenedores…"
  if [[ "$PURGE_VOLUMES" -eq 1 ]]; then
    phantom_compose down -v --remove-orphans
    echo "[+] Contenedores y volúmenes Docker eliminados"
  else
    phantom_compose down --remove-orphans
    echo "[+] Contenedores detenidos (volúmenes conservados)"
  fi
else
  echo "[*] Docker no disponible; omitiendo compose down"
fi

if [[ "$DEEP_CLEAN" -eq 1 ]]; then
  echo "[*] Eliminando artefactos de build local…"
  rm -rf "$PHANTOM_ROOT/node_modules" "$PHANTOM_ROOT/.next"
  rm -rf "$PHANTOM_ROOT/backend/.venv" "$PHANTOM_ROOT/backend/__pycache__"
  find "$PHANTOM_ROOT/backend" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
  echo "[+] node_modules, .next y .venv eliminados"
fi

if [[ "$REMOVE_ENV" -eq 1 && -f "$PHANTOM_ROOT/.env" ]]; then
  rm -f "$PHANTOM_ROOT/.env"
  echo "[+] .env eliminado"
fi

echo ""
echo "[+] Desinstalación completada."
if [[ "$PURGE_VOLUMES" -eq 0 ]]; then
  echo "    Los datos en volúmenes Docker se conservaron."
  echo "    Para borrarlos: ./phantom uninstall --volumes"
fi
echo "============================================================"
