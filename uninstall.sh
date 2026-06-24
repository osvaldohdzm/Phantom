#!/usr/bin/env bash
# Phantom — desinstalar aplicación (detiene servicios y limpia artefactos locales).
# Uso: ./uninstall.sh
#      ./uninstall.sh --volumes     # borra también BD y storage Docker
#      ./uninstall.sh --env         # borra .env
#      ./uninstall.sh --all         # volúmenes + .env + node_modules/.next/.venv
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

PURGE_VOLUMES=0
REMOVE_ENV=0
DEEP_CLEAN=0

for arg in "$@"; do
  case "$arg" in
    --volumes) PURGE_VOLUMES=1 ;;
    --env) REMOVE_ENV=1 ;;
    --all) PURGE_VOLUMES=1; REMOVE_ENV=1; DEEP_CLEAN=1 ;;
    -h|--help)
      echo "Uso: ./uninstall.sh [--volumes] [--env] [--all]"
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
  echo "    Para borrarlos: ./uninstall.sh --volumes"
fi
echo "============================================================"
