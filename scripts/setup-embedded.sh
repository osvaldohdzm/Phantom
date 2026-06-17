#!/bin/bash
# Instalación NUEVA con SQLite embebido — no ejecutar sobre una instancia PostgreSQL existente.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
ENV_FILE="$BACKEND/.env"
DATA_DIR="$BACKEND/data"

if [ -f "$ENV_FILE" ]; then
  if grep -qE '^DATABASE_URL=.*postgresql' "$ENV_FILE" 2>/dev/null; then
    echo "[!] Ya existe backend/.env con PostgreSQL. Este script es solo para instalaciones nuevas."
    echo "    Si quieres SQLite, haz backup y edita DATABASE_URL manualmente o usa Administración → Base de datos."
    exit 1
  fi
fi

mkdir -p "$DATA_DIR"
cp "$BACKEND/.env.embedded.example" "$ENV_FILE"
echo "[+] Creado $ENV_FILE (SQLite en $DATA_DIR/spectre.db)"
echo "[*] Arranca con: ./start-dev.sh"
