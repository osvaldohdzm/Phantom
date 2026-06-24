#!/usr/bin/env bash
# Phantom — validar variables de entorno requeridas.
# Uso: ./verify-env.sh
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

phantom_cd_root
FAIL=0

echo "[*] Verificando .env…"

if [[ ! -f .env ]]; then
  echo "    FAIL — falta .env (ejecuta: ./install.sh)"
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
  echo "    Generar secretos: ./install.sh"
  exit 1
fi

echo "[+] Entorno válido"
exit 0
