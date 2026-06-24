#!/usr/bin/env bash
# Phantom — respaldo de base de datos y storage.
# Uso: ./backup.sh
#      ./backup.sh /ruta/destino
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

phantom_load_env
phantom_require_compose

DEST="${1:-$PHANTOM_ROOT/backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR="$DEST/phantom_${STAMP}"
mkdir -p "$OUT_DIR"

DB_USER="${POSTGRES_USER:-phantom}"
DB_NAME="${POSTGRES_DB:-katana_security_db}"

echo "============================================================"
echo " Phantom — backup"
echo "============================================================"
echo "[*] Destino: $OUT_DIR"

echo "[*] Volcado PostgreSQL…"
if ! phantom_compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$OUT_DIR/database.sql"; then
  echo "[!] Error en pg_dump"
  exit 1
fi

echo "[*] Exportando storage del API…"
if phantom_compose exec -T api test -d /app/backend/storage 2>/dev/null; then
  phantom_compose exec -T api tar -czf - -C /app/backend storage > "$OUT_DIR/storage.tar.gz" 2>/dev/null || {
    echo "[!] No se pudo empaquetar storage (puede estar vacío)"
    rm -f "$OUT_DIR/storage.tar.gz"
  }
fi

cp "$PHANTOM_ROOT/.env" "$OUT_DIR/env.snapshot" 2>/dev/null || true

(
  cd "$DEST"
  tar -czf "phantom_${STAMP}.tar.gz" "phantom_${STAMP}"
  rm -rf "phantom_${STAMP}"
)

ARCHIVE="$DEST/phantom_${STAMP}.tar.gz"
echo ""
echo "[+] Backup listo: $ARCHIVE"
ls -lh "$ARCHIVE"
echo "============================================================"
