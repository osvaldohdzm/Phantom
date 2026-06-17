#!/bin/bash

# Exit on unexpected failures (except daemon failures)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-cert-hosts.sh"
load_cert_extra_hosts_from_env
TS_IP=$(tailscale_ipv4 || true)
DEV_ALLOWED_ORIGINS="localhost,127.0.0.1${TS_IP:+,${TS_IP}}${CERT_EXTRA_HOSTS:+,${CERT_EXTRA_HOSTS// /,}}"
export DEV_ALLOWED_ORIGINS

echo "============================================================"
echo "⚡ Phantom — DEVELOPMENT (hot-reload)"
echo "============================================================"

# Helper function to kill background jobs on exit
cleanup() {
  echo ""
  echo "[-] Shutting down background processes..."
  
  if [ ! -z "$BACKEND_PID" ]; then
    echo "[*] Terminating FastAPI backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
  fi
  
  if [ ! -z "$FRONTEND_PID" ]; then
    echo "[*] Terminating Next.js frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
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
  source .venv/bin/activate
  echo "[*] Checking Python dependencies..."
  pip install -r requirements.txt &>/dev/null || pip install -r requirements.txt
else
  echo "[!] Warn: .venv directory not found in backend/. Running python natively."
fi

echo "[*] Launching Uvicorn FastAPI server on port 8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# 3. Start Next.js Frontend
echo "[+] Initializing Next.js Frontend..."
if [ ! -d "node_modules" ]; then
  echo "[*] Installing frontend dependencies..."
  npm install
fi

echo "[*] Launching Next.js server on port 3000..."
echo "    Allowed dev origins: ${DEV_ALLOWED_ORIGINS}"
npm run dev -- -H 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo "🚀 Phantom Cyber Security Platform is launching!"
echo "   - Frontend: http://0.0.0.0:3000  (accesible por IP LAN)"
echo "   - Backend API: http://0.0.0.0:8000"
echo "============================================================"
echo "[*] Press Ctrl+C to stop all services."
echo ""

# Keep shell active and wait for background processes
wait
