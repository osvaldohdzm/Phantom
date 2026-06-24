#!/usr/bin/env bash
# Phantom — detener stack Docker (conserva volúmenes y datos).
# Uso: ./stop.sh
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

echo "[*] Deteniendo Phantom…"
phantom_require_compose
phantom_compose down
echo "[+] Servicios detenidos. Datos en volúmenes conservados."
