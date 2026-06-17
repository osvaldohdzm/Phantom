#!/bin/bash
# Shared helpers: CERT_EXTRA_HOSTS from .env + Tailscale/LAN detection.
# shellcheck disable=SC2034
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_cert_extra_hosts_from_env() {
  for f in "$ROOT/.env.local" "$ROOT/.env"; do
    [[ -f "$f" ]] || continue
    line=$(grep -E '^CERT_EXTRA_HOSTS=' "$f" 2>/dev/null | tail -1 || true)
    [[ -z "$line" ]] && continue
    val="${line#CERT_EXTRA_HOSTS=}"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    [[ -n "$val" ]] && CERT_EXTRA_HOSTS="${CERT_EXTRA_HOSTS:-} $val"
  done
  CERT_EXTRA_HOSTS="${CERT_EXTRA_HOSTS# }"
}

tailscale_ipv4() {
  local bin=""
  bin=$(command -v tailscale 2>/dev/null || true)
  if [[ -z "$bin" && -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then
    bin=/Applications/Tailscale.app/Contents/MacOS/Tailscale
  fi
  [[ -n "$bin" ]] || return 0
  "$bin" ip -4 2>/dev/null | head -1
}

collect_access_urls() {
  ACCESS_URLS=()
  ACCESS_URLS+=("https://localhost:${PORT:-3000}")
  local ts lan
  ts=$(tailscale_ipv4 || true)
  [[ -n "$ts" ]] && ACCESS_URLS+=("https://${ts}:${PORT:-3000}")
  for iface in en0 en1 en2; do
    lan=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    [[ -n "$lan" ]] && ACCESS_URLS+=("https://${lan}:${PORT:-3000}")
  done
}

cert_includes_ip() {
  local ip="$1"
  local cert="$2"
  [[ -z "$ip" || ! -f "$cert" ]] && return 1
  openssl x509 -in "$cert" -noout -text 2>/dev/null | grep -q "$ip"
}
