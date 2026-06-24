#!/usr/bin/env bash
# Repara acceso HTTPS a Phantom en Docker (certificado + firewall + verificación).
# Uso en el servidor: cd /ruta/a/Phantom && sudo ./scripts/fix-docker-access.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/docker-compose.yml" ]]; then
  echo "[!] Ejecuta desde la raíz del repo Phantom."
  exit 1
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
PORT=$(grep -E '^PHANTOM_HTTP_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2 || echo 3000)
PORT=${PORT:-3000}
SANS="localhost,127.0.0.1,${IP}"

if [[ -f "$ROOT/.env" ]]; then
  if grep -qE '^PHANTOM_TLS_SANS=' "$ROOT/.env"; then
    sed -i "s/^PHANTOM_TLS_SANS=.*/PHANTOM_TLS_SANS=${SANS}/" "$ROOT/.env"
  else
    echo "PHANTOM_TLS_SANS=${SANS}" >> "$ROOT/.env"
  fi
else
  echo "[!] No hay .env — copia .env.example primero."
  exit 1
fi

echo "[+] PHANTOM_TLS_SANS=${SANS}"

if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -qi 'Status: active'; then
  ufw allow "${PORT}/tcp" comment 'Phantom SecOps web' || true
  echo "[+] ufw: allow ${PORT}/tcp"
fi

echo "[*] Recreando contenedor web…"
docker compose up -d --build web

echo "[*] Esperando HTTPS…"
OK=0
for i in $(seq 1 20); do
  if curl -kfsS "https://127.0.0.1:${PORT}/" -o /dev/null 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done

echo ""
if [[ "$OK" -eq 1 ]]; then
  echo "[+] Phantom responde en https://127.0.0.1:${PORT}"
  echo "    Desde tu PC: https://${IP}:${PORT}"
  echo "    Certificado autofirmado → Avanzado → continuar en el navegador."
else
  echo "[!] Sigue sin responder. Revisa:"
  echo "    docker compose ps"
  echo "    docker compose logs web --tail 80"
fi
