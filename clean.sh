#!/usr/bin/env bash
# Phantom — limpiar artefactos locales (sin borrar volúmenes Docker por defecto).
# Uso: ./clean.sh
#      ./clean.sh --docker    # también docker compose down
#      ./clean.sh --all       # docker down + node_modules + .next + .venv
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

DOCKER_DOWN=0
DEEP=0

for arg in "$@"; do
  case "$arg" in
    --docker) DOCKER_DOWN=1 ;;
    --all) DOCKER_DOWN=1; DEEP=1 ;;
    -h|--help)
      echo "Uso: ./clean.sh [--docker] [--all]"
      exit 0
      ;;
    *)
      echo "[!] Opción desconocida: $arg" >&2
      exit 1
      ;;
  esac
done

echo "============================================================"
echo " Phantom — limpieza"
echo "============================================================"

if [[ "$DOCKER_DOWN" -eq 1 ]] && phantom_require_compose 2>/dev/null; then
  echo "[*] Deteniendo contenedores…"
  phantom_compose down
fi

echo "[*] Limpiando cachés de build…"
rm -rf "$PHANTOM_ROOT/.next" "$PHANTOM_ROOT/tsconfig.tsbuildinfo" 2>/dev/null || true
find "$PHANTOM_ROOT/backend" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "$PHANTOM_ROOT/backend" -type f -name '*.pyc' -delete 2>/dev/null || true

if [[ "$DEEP" -eq 1 ]]; then
  echo "[*] Eliminando dependencias locales…"
  rm -rf "$PHANTOM_ROOT/node_modules" "$PHANTOM_ROOT/backend/.venv"
fi

echo "[+] Limpieza completada"
if [[ "$DEEP" -eq 0 ]]; then
  echo "    node_modules y volúmenes Docker no se tocaron."
  echo "    Limpieza profunda: ./clean.sh --all"
fi
echo "============================================================"
