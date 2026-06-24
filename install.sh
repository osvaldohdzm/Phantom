#!/usr/bin/env bash
# Phantom — instalar dependencias y preparar entorno (Docker).
# Uso: ./install.sh
#      sudo ./install.sh --system   # instala Docker Engine en Ubuntu
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

echo "============================================================"
echo " Phantom — instalación"
echo "============================================================"

if [[ "${1:-}" == "--system" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "[!] Usa: sudo ./install.sh --system"
    exit 1
  fi
  exec "$PHANTOM_ROOT/scripts/install-ubuntu.sh"
fi

phantom_cd_root
phantom_ensure_env_file
phantom_generate_secrets_if_needed
phantom_ensure_tls_sans

echo "[*] Verificando entorno…"
"$PHANTOM_ROOT/verify-env.sh" || true

phantom_require_compose

echo "[*] Construyendo imágenes (primera vez puede tardar varios minutos)…"
phantom_compose build

echo ""
echo "[+] Instalación lista."
echo "    Siguiente paso: ./start.sh"
echo ""
echo "    Modo nativo (sin Docker): ./scripts/start-native.sh"
echo "    Instalación completa Ubuntu: sudo ./install.sh --system"
echo "============================================================"
