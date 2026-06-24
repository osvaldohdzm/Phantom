#!/usr/bin/env bash
# Phantom — validar variables de entorno requeridas.
# Uso: ./verify-env.sh
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_cd_root
FAIL=0

echo "[*] Verificando .env…"

if [[ ! -f .env ]]; then
  echo "    FAIL — falta .env (ejecuta: ./phantom install)"
  exit 1
fi

phantom_load_env

check_var() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "    FAIL — $name vacío"
    FAIL=1
    return
  fi
  echo "    OK   — $name"
}

check_var POSTGRES_PASSWORD
check_var JWT_SECRET

if [[ "${POSTGRES_PASSWORD:-}" == "change_me_strong_password" ]]; then
  echo "    WARN — POSTGRES_PASSWORD sigue siendo el valor de ejemplo"
  FAIL=1
fi

if [[ "${JWT_SECRET:-}" == "change_me_jwt_secret_min_32_chars" ]]; then
  echo "    WARN — JWT_SECRET sigue siendo el valor de ejemplo"
  FAIL=1
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "    FAIL — JWT_SECRET debe tener al menos 32 caracteres"
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "[!] Corrige .env antes de continuar."
  echo "    Generar secretos: ./phantom install"
  exit 1
fi

echo "[+] Entorno válido"
exit 0
