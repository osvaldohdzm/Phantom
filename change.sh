#!/bin/bash
# Cambia usuario/contraseña del administrador Phantom (persistente en la BD).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
ENV_FILE="$BACKEND/.env"

echo "============================================================"
echo " Phantom — cambio de credenciales"
echo "============================================================"

if [[ ! -d "$BACKEND" ]]; then
  echo "[!] No se encontró el directorio backend/."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[!] Falta backend/.env (DATABASE_URL)."
  echo "    Copia backend/.env.example o configura la base antes de continuar."
  exit 1
fi

cd "$BACKEND"

if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif ! command -v python3 &>/dev/null; then
  echo "[!] Python no encontrado. Ejecuta primero ./start-dev.sh para crear .venv."
  exit 1
fi

if ! python3 -c "import sqlalchemy" 2>/dev/null; then
  echo "[*] Instalando dependencias Python…"
  pip install -q -r requirements.txt
fi

export PYTHONPATH="${BACKEND}${PYTHONPATH:+:$PYTHONPATH}"

if docker compose ps api --status running -q 2>/dev/null | grep -q .; then
  echo "[*] Stack Docker detectado — ejecutando en contenedor api…"
  exec docker compose exec -T api python -m scripts.change_credentials "$@"
fi

python3 -m scripts.change_credentials "$@"
status=$?

echo ""
if [[ $status -eq 0 ]]; then
  echo "Listo. Arranca la app con:"
  echo "  ./start-dev.sh   (desarrollo)"
  echo "  ./start-prod.sh  (producción)"
fi
exit $status
