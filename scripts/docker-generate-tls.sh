#!/bin/sh
# Self-signed TLS for Phantom web container (openssl, no mkcert).
# PHANTOM_TLS_SANS — comma-separated hostnames/IPs (e.g. localhost,127.0.0.1,10.0.0.5)
set -eu

CERT_DIR="${CERT_DIR:-/app/certificates}"
CERT="${CERT_DIR}/localhost.pem"
KEY="${CERT_DIR}/localhost-key.pem"
SANS_MARKER="${CERT_DIR}/sans.txt"

mkdir -p "$CERT_DIR"

# Pipe-delimited unique SAN tokens
SANS=""
add_san() {
  token="$1"
  [ -z "$token" ] && return 0
  case "$SANS" in
    *"|${token}|"*) return 0 ;;
  esac
  SANS="${SANS}|${token}|"
}

add_san localhost
add_san phantom.local
add_san 127.0.0.1
add_san ::1

if [ -n "${PHANTOM_TLS_SANS:-}" ]; then
  OLDIFS=$IFS
  IFS=','
  for item in $PHANTOM_TLS_SANS; do
    item=$(echo "$item" | tr -d ' \t\r\n')
    add_san "$item"
  done
  IFS=$OLDIFS
fi

if [ -f "$CERT" ] && [ -f "$KEY" ] && [ -f "$SANS_MARKER" ] && [ "$(cat "$SANS_MARKER")" = "$SANS" ]; then
  exit 0
fi

echo "[web] Generating self-signed TLS certificate (365 days)…"
echo "[web] SANs:${SANS}"

OPENSSL_CNF="${CERT_DIR}/openssl.cnf"
SUBJECT_ALT=""
OLDIFS=$IFS
IFS='|'
for item in $SANS; do
  [ -z "$item" ] && continue
  case "$item" in
    *:*)
      entry="IP:${item}"
      ;;
    *)
      if echo "$item" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then
        entry="IP:${item}"
      else
        entry="DNS:${item}"
      fi
      ;;
  esac
  if [ -z "$SUBJECT_ALT" ]; then
    SUBJECT_ALT="$entry"
  else
    SUBJECT_ALT="${SUBJECT_ALT},${entry}"
  fi
done
IFS=$OLDIFS

cat > "$OPENSSL_CNF" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = phantom.local
O = Phantom SecOps

[v3_req]
subjectAltName = ${SUBJECT_ALT}
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$KEY" \
  -out "$CERT" \
  -config "$OPENSSL_CNF" \
  -extensions v3_req \
  >/dev/null 2>&1

chmod 600 "$KEY"
echo "$SANS" > "$SANS_MARKER"
echo "[web] Wrote ${CERT}"
