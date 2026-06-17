#!/bin/bash
# Generate local TLS certs trusted by mkcert (localhost + LAN/Tailscale IPs).
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/certificates"
mkdir -p "$CERT_DIR"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-cert-hosts.sh"
load_cert_extra_hosts_from_env

if ! command -v mkcert &>/dev/null; then
  echo "[!] mkcert not found. Install: brew install mkcert && mkcert -install"
  exit 1
fi

HOSTS=(
  localhost
  127.0.0.1
  ::1
)

# Tailscale IPv4
TS_IP=$(tailscale_ipv4 || true)
[[ -n "$TS_IP" ]] && HOSTS+=("$TS_IP")

# macOS LAN (Wi‑Fi / Ethernet)
for iface in en0 en1 en2; do
  ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
  [[ -n "$ip" ]] && HOSTS+=("$ip")
done

# Linux primary route
if command -v hostname &>/dev/null && [[ "$(uname -s)" == "Linux" ]]; then
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  [[ -n "$ip" ]] && HOSTS+=("$ip")
fi

# Extra hosts from env (space-separated): CERT_EXTRA_HOSTS="100.107.190.11 192.168.0.176"
if [[ -n "${CERT_EXTRA_HOSTS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA=($CERT_EXTRA_HOSTS)
  HOSTS+=("${EXTRA[@]}")
fi

# De-duplicate while preserving order (bash 3.2 compatible)
UNIQUE=()
for h in "${HOSTS[@]}"; do
  [[ -z "$h" ]] && continue
  dup=0
  for u in "${UNIQUE[@]}"; do
    [[ "$u" == "$h" ]] && dup=1 && break
  done
  [[ "$dup" -eq 0 ]] && UNIQUE+=("$h")
done

echo "[*] Generating certificate for: ${UNIQUE[*]}"
mkcert -install 2>/dev/null || mkcert -install
mkcert -key-file "$CERT_DIR/localhost-key.pem" -cert-file "$CERT_DIR/localhost.pem" "${UNIQUE[@]}"

echo "[+] Wrote $CERT_DIR/localhost.pem"
openssl x509 -in "$CERT_DIR/localhost.pem" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | sed 's/^/    /' || true
