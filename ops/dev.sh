#!/bin/bash

# Exit on unexpected failures (except daemon failures)
set -e

PHANTOM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$PHANTOM_ROOT"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-cert-hosts.sh"
load_cert_extra_hosts_from_env
TS_IP=$(tailscale_ipv4 || true)

BACKEND_PORT="${PHANTOM_BACKEND_PORT:-8000}"
FRONTEND_PORT="${PHANTOM_FRONTEND_PORT:-3000}"

CERT="$ROOT/certificates/localhost.pem"
KEY="$ROOT/certificates/localhost-key.pem"
if [[ ! -f "$CERT" || ! -f "$KEY" ]]; then
  echo "[!] Missing TLS certs — run: ./scripts/generate-certs.sh"
  exit 1
fi

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

DEV_ALLOWED_ORIGINS="localhost,127.0.0.1${TS_IP:+,${TS_IP}}${CERT_EXTRA_HOSTS:+,${CERT_EXTRA_HOSTS// /,}}"
export DEV_ALLOWED_ORIGINS

echo "============================================================"
echo "⚡ Phantom — DEVELOPMENT (HTTPS + hot-reload)"
echo "============================================================"

list_port_listeners() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

pids_on_port() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u | tr '\n' ' ' | sed 's/[[:space:]]*$//'
}

describe_pid() {
  local pid="$1"
  ps -p "$pid" -o pid=,ppid=,args= 2>/dev/null | sed 's/^/      /'
}

is_likely_phantom_dev() {
  local pid="$1"
  local args
  args=$(ps -p "$pid" -o args= 2>/dev/null || true)
  echo "$args" | grep -qiE '(uvicorn|next dev|next-server|node.*server-dev|node.*next|spectre|\.next/)' && return 0
  return 1
}

kill_pids_gracefully() {
  local pids="$1"
  [ -z "$pids" ] && return 0
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 1
  local still
  still=$(echo "$pids" | tr ' ' '\n' | while read -r pid; do
    [ -z "$pid" ] && continue
    kill -0 "$pid" 2>/dev/null && echo "$pid"
  done | tr '\n' ' ')
  if [ -n "$still" ]; then
    echo "[*] Forzando cierre (kill -9): $still"
    # shellcheck disable=SC2086
    kill -9 $still 2>/dev/null || true
    sleep 1
  fi
}

free_port() {
  local port="$1"
  local label="$2"
  local pids
  pids=$(pids_on_port "$port")
  [ -z "$pids" ] && return 0

  echo "[!] Puerto $port en uso ($label)."
  list_port_listeners "$port"
  echo "[*] Proceso(s) escuchando:"
  for pid in $pids; do
    describe_pid "$pid"
  done

  local phantom_hint=""
  for pid in $pids; do
    if is_likely_phantom_dev "$pid"; then
      phantom_hint="phantom"
      break
    fi
  done

  if [ -n "$phantom_hint" ]; then
    echo "    (Parece un servidor Phantom / uvicorn / Next.js anterior.)"
  else
    echo "    (Otro programa usa este puerto — revísalo antes de continuar.)"
  fi

  if [ "${PHANTOM_FORCE_PORTS:-}" = "1" ]; then
    echo "[*] PHANTOM_FORCE_PORTS=1 — cerrando sin preguntar."
  else
  echo ""
  read -r -p "¿Cerrar proceso(s) en puerto $port y continuar? [s/N] " answer
  case "$answer" in
    s|S|y|Y|si|sí|SI|SÍ) ;;
    *)
      echo "Cancelado. Libera el puerto manualmente o usa PHANTOM_FORCE_PORTS=1 ./phantom dev"
      exit 1
      ;;
  esac
  fi

  echo "[*] Terminando PID(s): $pids"
  kill_pids_gracefully "$pids"

  if [ -n "$(pids_on_port "$port")" ]; then
    echo "[!] No se pudo liberar el puerto $port."
    list_port_listeners "$port"
    exit 1
  fi
  echo "[+] Puerto $port libre."
}

# Helper function to kill background jobs on exit
cleanup() {
  echo ""
  echo "[-] Shutting down background processes..."

  if [ -n "${BACKEND_PID:-}" ]; then
    echo "[*] Terminating FastAPI backend (PID: $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "${FRONTEND_PID:-}" ]; then
    echo "[*] Terminating Next.js frontend (PID: $FRONTEND_PID)..."
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  # Por si quedaron hijos de uvicorn --reload o next dev
  local bp fp
  bp=$(pids_on_port "$BACKEND_PORT")
  fp=$(pids_on_port "$FRONTEND_PORT")
  if [ -n "$bp" ]; then
    echo "[*] Liberando puerto $BACKEND_PORT (PID: $bp)..."
    kill_pids_gracefully "$bp"
  fi
  if [ -n "$fp" ]; then
    echo "[*] Liberando puerto $FRONTEND_PORT (PID: $fp)..."
    kill_pids_gracefully "$fp"
  fi

  echo "[+] All services terminated successfully. Goodbye!"
}

# Set up trap to execute cleanup on Ctrl+C (SIGINT), SIGTERM, and normal script exit
trap cleanup EXIT INT TERM

# 1. Ensure Local Services Are Active
echo "[+] Verifying local database service..."
echo "    Assumes PostgreSQL (5432) is running locally."

# 2. Start Python FastAPI Backend
echo "[+] Initializing FastAPI Backend..."
cd backend

if [ -d ".venv" ]; then
  echo "[*] Activating Python virtual environment (.venv)..."
  # shellcheck disable=SC1091
  source .venv/bin/activate
  echo "[*] Checking Python dependencies..."
  pip install -r requirements.txt &>/dev/null || pip install -r requirements.txt
else
  echo "[!] Warn: .venv directory not found in backend/. Running python natively."
fi

echo "[*] Launching Uvicorn FastAPI server on port $BACKEND_PORT..."
free_port "$BACKEND_PORT" "backend"
uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!
cd ..

# 3. Start Next.js Frontend
echo "[+] Initializing Next.js Frontend..."
if [ ! -d "node_modules" ]; then
  echo "[*] Installing frontend dependencies..."
  npm install
fi

echo "[*] Launching Next.js HTTPS on port $FRONTEND_PORT..."
echo "    Allowed dev origins: ${DEV_ALLOWED_ORIGINS}"
free_port "$FRONTEND_PORT" "frontend"
export BIND_ADDRESS="0.0.0.0"
export PORT="$FRONTEND_PORT"
export SSL_CERT_PATH="$CERT"
export SSL_KEY_PATH="$KEY"
export CERT_EXTRA_HOSTS
node server-dev.mjs &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo "🚀 Phantom Cyber Security Platform is launching!"
if collect_access_urls; then
  for url in "${ACCESS_URLS[@]}"; do
    echo "   - Frontend: $url"
  done
else
  echo "   - Frontend: https://localhost:${FRONTEND_PORT}"
fi
echo "   - Backend API: http://127.0.0.1:${BACKEND_PORT} (proxied via /api/secops)"
echo "============================================================"
echo "[*] Press Ctrl+C to stop all services."
echo "[*] Cambiar contraseña admin: ./phantom change"
echo "[*] Si un puerto sigue ocupado: PHANTOM_FORCE_PORTS=1 ./phantom dev"
echo ""

# Keep shell active and wait for background processes
wait
