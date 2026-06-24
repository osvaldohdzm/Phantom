#!/bin/bash
# Phantom — production launcher (HTTPS frontend, optimized backend, no hot-reload)
set -euo pipefail

PHANTOM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$PHANTOM_ROOT"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-cert-hosts.sh"
load_cert_extra_hosts_from_env

echo "============================================================"
echo " Phantom — PRODUCTION (HTTPS + optimized)"
echo "============================================================"

cleanup() {
  echo ""
  echo "[-] Shutting down..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  echo "[+] Stopped."
}
trap cleanup EXIT INT TERM

export NODE_ENV=production
export API_PROXY_URL="${API_PROXY_URL:-http://127.0.0.1:8000}"

CERT="$ROOT/certificates/localhost.pem"
KEY="$ROOT/certificates/localhost-key.pem"
if [[ ! -f "$CERT" || ! -f "$KEY" ]]; then
  echo "[!] Missing TLS certs — run: ./scripts/generate-certs.sh"
  exit 1
fi

# Warn / auto-fix certs missing Tailscale or .env hosts
TS_IP=$(tailscale_ipv4 || true)
MISSING_CERT_IPS=()
[[ -n "$TS_IP" ]] && ! cert_includes_ip "$TS_IP" "$CERT" && MISSING_CERT_IPS+=("$TS_IP")
if [[ -n "${CERT_EXTRA_HOSTS:-}" ]]; then
  # shellcheck disable=SC2206
  for ip in ${CERT_EXTRA_HOSTS}; do
    [[ "$ip" =~ ^[0-9.]+$ ]] || continue
    cert_includes_ip "$ip" "$CERT" || MISSING_CERT_IPS+=("$ip")
  done
fi
if [[ ${#MISSING_CERT_IPS[@]} -gt 0 ]]; then
  echo "[!] TLS cert missing IP(s): ${MISSING_CERT_IPS[*]}"
  if command -v mkcert &>/dev/null; then
    echo "[*] Regenerating certificates..."
    CERT_EXTRA_HOSTS="${CERT_EXTRA_HOSTS:-} ${MISSING_CERT_IPS[*]}"
    export CERT_EXTRA_HOSTS
    "$ROOT/scripts/generate-certs.sh"
  else
    echo "    Run: CERT_EXTRA_HOSTS='${MISSING_CERT_IPS[*]}' ./scripts/generate-certs.sh"
    exit 1
  fi
fi

# Workers: use half CPU cores (min 2) for Uvicorn
if [[ -z "${UVICORN_WORKERS:-}" ]]; then
  if command -v sysctl &>/dev/null; then
    CPU=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
  else
    CPU=$(nproc 2>/dev/null || echo 4)
  fi
  UVICORN_WORKERS=$(( CPU > 2 ? CPU / 2 : 2 ))
  [[ "$UVICORN_WORKERS" -lt 2 ]] && UVICORN_WORKERS=2
fi

echo "[+] Backend (FastAPI, ${UVICORN_WORKERS} workers, HTTP localhost)..."
cd "$ROOT/backend"
if [[ -d ".venv" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -q -r requirements.txt
else
  echo "[!] backend/.venv not found — create venv first."
  exit 1
fi

echo "[+] Database bootstrap (single process)..."
python -m app.bootstrap_db
export PHANTOM_DB_BOOTSTRAPPED=1

uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --workers "$UVICORN_WORKERS" \
  --no-access-log \
  --log-level warning &
BACKEND_PID=$!
cd "$ROOT"

echo "[+] Frontend — building Next.js (production)..."
if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run build

echo "[+] Frontend — HTTPS on port ${PORT:-3000} (all interfaces)..."
# macOS exports HOSTNAME=MacBook-....local — never use for bind; use BIND_ADDRESS.
export BIND_ADDRESS="0.0.0.0"
export PORT="${PORT:-3000}"
export SSL_CERT_PATH="$CERT"
export SSL_KEY_PATH="$KEY"
export CERT_EXTRA_HOSTS

node server-prod.mjs &
FRONTEND_PID=$!

if ! collect_access_urls; then
  echo "[!] Warning: unable to enumerate all interface URLs; continuing with available endpoints."
fi
echo ""
echo "============================================================"
echo " Phantom is running (production)"
for url in "${ACCESS_URLS[@]}"; do
  echo "   $url"
done
echo "   Backend:   ${API_PROXY_URL} (proxied via /api/secops)"
echo "   Workers:   ${UVICORN_WORKERS}"
echo "============================================================"
echo "[*] Ctrl+C to stop."
echo "[*] Cambiar contraseña admin: ./phantom change"
echo ""

wait
