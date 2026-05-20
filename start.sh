#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-2020}"

if command -v lsof >/dev/null 2>&1; then
  if lsof -Pi :"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Error: el puerto $PORT ya está en uso. Libéralo o usa PORT=XXXX ./start.sh" >&2
    exit 1
  fi
fi

echo "------------------------------------------------"
echo "Spectre — modo desarrollo en https://localhost:$PORT"
echo "Nota: Acepta el certificado auto-firmado en tu navegador."
echo "------------------------------------------------"

exec npm run dev -- -p "$PORT" --experimental-https
