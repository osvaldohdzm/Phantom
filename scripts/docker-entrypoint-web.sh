#!/bin/sh
set -eu

CERT="/app/certificates/localhost.pem"
KEY="/app/certificates/localhost-key.pem"

sh /app/scripts/docker-generate-tls.sh

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "[web] FATAL: TLS certificate generation failed." >&2
  exit 1
fi

export BIND_ADDRESS="${BIND_ADDRESS:-0.0.0.0}"
export PORT="${PORT:-3000}"
export SSL_CERT_PATH="$CERT"
export SSL_KEY_PATH="$KEY"
export API_PROXY_URL="${API_PROXY_URL:-http://api:8000}"

echo "[web] API proxy → ${API_PROXY_URL}"
echo "[web] HTTPS on ${BIND_ADDRESS}:${PORT} (cert: ${SSL_CERT_PATH})"

exec node server-prod.mjs
