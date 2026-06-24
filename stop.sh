#!/usr/bin/env bash
# Phantom — detener stack Docker (conserva volúmenes y datos).
# Uso: ./stop.sh
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/phantom-lib.sh
source "$PHANTOM_ROOT/scripts/phantom-lib.sh"

echo "[*] Deteniendo Phantom…"
phantom_require_compose
phantom_compose down
echo "[+] Servicios detenidos. Datos en volúmenes conservados."
