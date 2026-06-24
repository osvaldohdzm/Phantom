#!/bin/sh
set -eu

CERT="/app/certificates/localhost.pem"
KEY="/app/certificates/localhost-key.pem"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "[web] Generating self-signed TLS certificate (365 days)…"
  mkdir -p /app/certificates
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CERT" \
    -subj "/CN=phantom.local/O=Phantom SecOps" \
    2>/dev/null
fi

export BIND_ADDRESS="${BIND_ADDRESS:-0.0.0.0}"
export PORT="${PORT:-3000}"
export SSL_CERT_PATH="$CERT"
export SSL_KEY_PATH="$KEY"
export API_PROXY_URL="${API_PROXY_URL:-http://api:8000}"

echo "[web] API proxy → ${API_PROXY_URL}"
echo "[web] HTTPS on ${BIND_ADDRESS}:${PORT}"

exec node server-prod.mjs
