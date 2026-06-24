#!/usr/bin/env bash
# Phantom — instalar dependencias y preparar entorno (Docker).
# Uso: ./phantom install
#      sudo ./phantom install --system   # instala Docker Engine en Ubuntu
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

echo "============================================================"
echo " Phantom — instalación"
echo "============================================================"

if [[ "${1:-}" == "--system" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "[!] Usa: sudo ./phantom install --system"
    exit 1
  fi
  exec "$PHANTOM_ROOT/scripts/install-ubuntu.sh"
fi

phantom_cd_root
phantom_ensure_env_file
phantom_generate_secrets_if_needed
phantom_ensure_tls_sans

echo "[*] Verificando entorno…"
"$OPS_DIR/verify-env.sh" || true

phantom_require_compose

echo "[*] Construyendo imágenes (primera vez puede tardar varios minutos)…"
phantom_compose build

echo ""
echo "[+] Instalación lista."
echo "    Siguiente paso: ./phantom start"
echo ""
echo "    Modo nativo (sin Docker): ./phantom native"
echo "    Instalación completa Ubuntu: sudo ./phantom install --system"
echo "============================================================"
