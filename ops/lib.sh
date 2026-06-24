#!/usr/bin/env bash
# Phantom SecOps — helpers compartidos (ops/lib.sh).
set -euo pipefail

phantom_repo_root() {
  if [[ -n "${PHANTOM_ROOT:-}" ]]; then
    echo "$PHANTOM_ROOT"
    return
  fi
  local caller
  caller="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  case "$(basename "$caller")" in
    ops) echo "$(cd "$caller/.." && pwd)" ;;
    scripts) echo "$(cd "$caller/.." && pwd)" ;;
    *) echo "$caller" ;;
  esac
}

phantom_cd_root() {
  cd "$(phantom_repo_root)"
}

phantom_load_env() {
  phantom_cd_root
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  export PHANTOM_HTTP_PORT="${PHANTOM_HTTP_PORT:-3000}"
}

phantom_compose() {
  phantom_cd_root
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  elif command -v podman &>/dev/null && podman compose version &>/dev/null 2>&1; then
    podman compose "$@"
  else
    echo "[!] Docker Compose o Podman Compose no está disponible." >&2
    echo "    Ubuntu: sudo ./phantom install --system" >&2
    echo "    o: sudo ./ops/install.sh --system" >&2
    exit 1
  fi
}

phantom_require_compose() {
  phantom_compose version >/dev/null
}

phantom_host_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

phantom_print_urls() {
  phantom_load_env
  local ip
  ip="$(phantom_host_ip)"
  echo ""
  echo "============================================================"
  echo " Phantom"
  echo "   https://${ip}:${PHANTOM_HTTP_PORT}"
  echo "   https://localhost:${PHANTOM_HTTP_PORT}"
  echo "============================================================"
}

phantom_ensure_env_file() {
  phantom_cd_root
  if [[ -f .env ]]; then
    return 0
  fi
  if [[ ! -f .env.example ]]; then
    echo "[!] No existe .env ni .env.example" >&2
    exit 1
  fi
  cp .env.example .env
  echo "[+] Creado .env desde .env.example"
}

phantom_generate_secrets_if_needed() {
  phantom_cd_root
  [[ -f .env ]] || return 0
  if grep -q 'change_me_strong_password' .env 2>/dev/null && command -v openssl &>/dev/null; then
    local pw jwt
    pw=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    jwt=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/change_me_strong_password/${pw}/" .env
      sed -i '' "s/change_me_jwt_secret_min_32_chars/${jwt}/" .env
    else
      sed -i "s/change_me_strong_password/${pw}/" .env
      sed -i "s/change_me_jwt_secret_min_32_chars/${jwt}/" .env
    fi
    echo "[+] Secretos generados en .env (POSTGRES_PASSWORD, JWT_SECRET)"
  fi
}

phantom_ensure_tls_sans() {
  phantom_cd_root
  [[ -f .env ]] || return 0
  if grep -qE '^PHANTOM_TLS_SANS=' .env 2>/dev/null; then
    return 0
  fi
  local ip
  ip="$(phantom_host_ip)"
  echo "PHANTOM_TLS_SANS=localhost,127.0.0.1,${ip}" >> .env
  echo "[+] PHANTOM_TLS_SANS=localhost,127.0.0.1,${ip}"
}

phantom_stack_running() {
  phantom_compose ps --status running 2>/dev/null | grep -qE 'phantom-(web|api)-' || return 1
}

phantom_ops_dir() {
  echo "$(phantom_repo_root)/ops"
}
