#!/usr/bin/env bash
# Instala Docker Desktop en macOS (Homebrew) y espera a que el daemon esté listo.
# Uso: ./scripts/install-docker-macos.sh
#      ./phantom install --docker
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=../ops/lib.sh
source "$ROOT/ops/lib.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[!] Este script solo aplica en macOS." >&2
  echo "    Ubuntu: sudo ./phantom install --system" >&2
  exit 1
fi

if ! command -v brew &>/dev/null; then
  echo "[!] Homebrew no encontrado." >&2
  echo "    Instálalo: https://brew.sh" >&2
  echo '    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' >&2
  exit 1
fi

echo "============================================================"
echo " Phantom — Docker Desktop (macOS)"
echo "============================================================"

if [[ ! -d /Applications/Docker.app ]]; then
  echo "[*] Instalando Docker Desktop (brew cask)…"
  echo "    Puede pedir tu contraseña de macOS (sudo) para enlazar el CLI."
  if ! brew install --cask docker; then
    echo ""
    echo "[!] brew no pudo terminar la instalación." >&2
    echo "    Ejecuta en Terminal.app (interactivo):" >&2
    echo "      brew install --cask docker" >&2
    echo "    O descarga: https://docs.docker.com/desktop/setup/install/mac-install/" >&2
    exit 1
  fi
else
  echo "[*] Docker Desktop ya está instalado."
fi

docker_bin="$(phantom_docker_bin 2>/dev/null || true)"
if [[ -z "$docker_bin" ]]; then
  echo "[!] docker CLI no encontrado tras instalar Docker Desktop." >&2
  echo "    Abre Docker.app una vez desde Aplicaciones y reintenta." >&2
  exit 1
fi

if ! "$docker_bin" info &>/dev/null 2>&1; then
  echo "[*] Abriendo Docker Desktop (primera vez puede pedir permisos)…"
  open -a Docker
fi

echo "[*] Esperando daemon Docker (hasta ~2 min)…"
ready=0
for _ in $(seq 1 60); do
  if "$docker_bin" info &>/dev/null 2>&1 && "$docker_bin" compose version &>/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "[!] Docker no respondió a tiempo." >&2
  echo "    1. Abre Docker Desktop desde Aplicaciones" >&2
  echo "    2. Acepta permisos / inicia sesión si lo pide" >&2
  echo "    3. Cuando el icono deje de parpadear: ./phantom install" >&2
  exit 1
fi

"$docker_bin" compose version
echo ""
echo "[+] Docker Desktop listo."
echo "    Siguiente: ./phantom install && ./phantom start"
echo "============================================================"
