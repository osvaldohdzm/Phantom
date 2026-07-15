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

phantom_is_darwin() {
  [[ "$(uname -s)" == "Darwin" ]]
}

phantom_sed_inplace() {
  local expr="$1"
  local file="$2"
  if phantom_is_darwin; then
    sed -i '' "$expr" "$file"
  else
    sed -i "$expr" "$file"
  fi
}

phantom_docker_bin() {
  if command -v docker &>/dev/null; then
    command -v docker
    return 0
  fi
  if [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
    echo /Applications/Docker.app/Contents/Resources/bin/docker
    return 0
  fi
  return 1
}

phantom_compose() {
  phantom_cd_root
  local docker_bin
  if docker_bin="$(phantom_docker_bin 2>/dev/null)" && "$docker_bin" compose version &>/dev/null 2>&1; then
    "$docker_bin" compose "$@"
  elif command -v podman &>/dev/null && podman compose version &>/dev/null 2>&1; then
    podman compose "$@"
  else
    echo "[!] Docker Compose o Podman Compose no está disponible." >&2
    if phantom_is_darwin; then
      echo "    macOS: ./phantom install --docker   (instala Docker Desktop)" >&2
      echo "    https://docs.docker.com/desktop/setup/install/mac-install/" >&2
      echo "    Sin Docker: ./phantom native   o   ./phantom dev" >&2
    else
      echo "    Ubuntu: sudo ./phantom install --system" >&2
      echo "    o: sudo ./ops/install.sh --system" >&2
    fi
    exit 1
  fi
}

phantom_require_compose() {
  phantom_compose version >/dev/null
}

phantom_host_ip() {
  if phantom_is_darwin; then
    ipconfig getifaddr en0 2>/dev/null \
      || ipconfig getifaddr en1 2>/dev/null \
      || echo "127.0.0.1"
    return
  fi
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

phantom_ensure_env_defaults() {
  phantom_cd_root
  [[ -f .env ]] || return 0
  local pair key val
  while IFS= read -r pair; do
  key="${pair%%=*}"
  val="${pair#*=}"
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || continue
  if ! grep -qE "^${key}=" .env 2>/dev/null; then
    echo "${key}=${val}" >> .env
    echo "[+] Añadido ${key} a .env"
  fi
  done <<'EOF'
POSTGRES_USER=phantom
POSTGRES_PASSWORD=change_me_strong_password
POSTGRES_DB=katana_security_db
JWT_SECRET=change_me_jwt_secret_min_32_chars
JWT_EXPIRE_MINUTES=480
AUTH_REQUIRED=true
PHANTOM_HTTP_PORT=3000
EOF
}

phantom_set_env_var() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" .env; then
    phantom_sed_inplace "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

phantom_generate_secrets_if_needed() {
  phantom_cd_root
  [[ -f .env ]] || return 0
  phantom_ensure_env_defaults
  command -v openssl &>/dev/null || return 0

  phantom_load_env
  local changed=0 pw jwt

  if [[ -z "${POSTGRES_PASSWORD:-}" || "${POSTGRES_PASSWORD}" == "change_me_strong_password" ]]; then
    pw=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    phantom_set_env_var POSTGRES_PASSWORD "$pw"
    changed=1
  fi

  if [[ -z "${JWT_SECRET:-}" || "${JWT_SECRET}" == "change_me_jwt_secret_min_32_chars" || ${#JWT_SECRET} -lt 32 ]]; then
    jwt=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
    phantom_set_env_var JWT_SECRET "$jwt"
    changed=1
  fi

  if [[ "$changed" -eq 1 ]]; then
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

phantom_has_compose() {
  local docker_bin
  if docker_bin="$(phantom_docker_bin 2>/dev/null)" && "$docker_bin" compose version &>/dev/null 2>&1; then
    return 0
  fi
  if command -v podman &>/dev/null && podman compose version &>/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# macOS sin Docker → nativo por defecto. Forzar Docker: PHANTOM_MODE=docker
phantom_wait_for_docker() {
  local i docker_bin
  echo "[*] Esperando Docker Desktop…"
  for i in $(seq 1 60); do
    if docker_bin="$(phantom_docker_bin 2>/dev/null)" \
      && "$docker_bin" info &>/dev/null 2>&1 \
      && "$docker_bin" compose version &>/dev/null 2>&1; then
      echo "[+] Docker listo"
      return 0
    fi
    sleep 2
  done
  echo "[!] Docker no respondió. Abre Docker Desktop y reintenta." >&2
  return 1
}

phantom_install_docker_macos() {
  "$PHANTOM_ROOT/scripts/install-docker-macos.sh"
}

phantom_ensure_docker_mode() {
  phantom_cd_root
  [[ -f .env ]] || return 0
  if ! grep -qE '^PHANTOM_MODE=' .env 2>/dev/null; then
    echo "PHANTOM_MODE=docker" >> .env
    echo "[+] PHANTOM_MODE=docker en .env"
  elif grep -qE '^PHANTOM_MODE=native' .env 2>/dev/null; then
    phantom_sed_inplace 's/^PHANTOM_MODE=native/PHANTOM_MODE=docker/' .env
    echo "[+] PHANTOM_MODE=docker en .env"
  fi
}

phantom_use_native_mode() {
  if [[ "${PHANTOM_MODE:-}" == "native" ]]; then
    return 0
  fi
  if [[ "${PHANTOM_MODE:-}" == "docker" ]]; then
    return 1
  fi
  phantom_is_darwin && ! phantom_has_compose
}

phantom_ensure_backend_env() {
  phantom_cd_root
  [[ -f backend/.env ]] && return 0

  if [[ -f backend/.env.embedded.example ]]; then
    cp backend/.env.embedded.example backend/.env
    echo "[+] Creado backend/.env (SQLite embebido — sin Postgres)"
  elif [[ -f backend/.env.example ]]; then
    cp backend/.env.example backend/.env
    echo "[+] Creado backend/.env desde backend/.env.example"
  else
    echo "[!] Falta backend/.env y no hay plantilla" >&2
    exit 1
  fi

  phantom_load_env
  if [[ -n "${JWT_SECRET:-}" ]]; then
    phantom_sed_inplace "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" backend/.env
  fi
}

phantom_install_native() {
  local ops_dir
  ops_dir="$(phantom_ops_dir)"

  echo "============================================================"
  echo " Phantom — instalación (nativo, sin Docker)"
  echo "============================================================"
  if [[ "${PHANTOM_MODE:-}" != "native" ]]; then
    echo "[*] macOS sin Docker detectado — instalación nativa automática"
    echo "    Forzar Docker: PHANTOM_MODE=docker ./phantom install"
    echo ""
  fi

  phantom_cd_root
  phantom_ensure_env_file
  phantom_generate_secrets_if_needed
  phantom_ensure_tls_sans
  phantom_ensure_backend_env

  echo "[*] Verificando entorno…"
  "$ops_dir/verify-env.sh"

  if ! command -v python3 &>/dev/null; then
    echo "[!] python3 no encontrado." >&2
    if phantom_is_darwin; then
      echo "    macOS: brew install python@3.11" >&2
    else
      echo "    Ubuntu: sudo apt install python3 python3-venv python3-pip" >&2
    fi
    exit 1
  fi

  if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "[!] Node.js / npm no encontrados." >&2
    if phantom_is_darwin; then
      echo "    macOS: brew install node" >&2
    else
      echo "    Ubuntu: sudo apt install nodejs npm  (o nvm)" >&2
    fi
    exit 1
  fi

  if [[ ! -d backend/.venv ]]; then
    echo "[*] Creando backend/.venv…"
    python3 -m venv backend/.venv
  fi
  echo "[*] Instalando dependencias Python…"
  backend/.venv/bin/pip install -q -r backend/requirements.txt

  if [[ ! -d node_modules ]]; then
    echo "[*] Instalando dependencias Node…"
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  else
    echo "[*] node_modules presente — omitiendo npm install"
  fi

  if [[ ! -f certificates/localhost.pem || ! -f certificates/localhost-key.pem ]]; then
    echo "[*] Generando certificados TLS…"
    if ! "$PHANTOM_ROOT/scripts/generate-certs.sh"; then
      echo "[!] mkcert requerido para HTTPS local." >&2
      if phantom_is_darwin; then
        echo "    macOS: brew install mkcert && mkcert -install" >&2
      else
        echo "    https://github.com/FiloSottile/mkcert#installation" >&2
      fi
      exit 1
    fi
  fi

  mkdir -p backend/data

  echo ""
  echo "[+] Instalación nativa lista."
  echo "    Arrancar:     ./phantom start"
  echo "    Desarrollo:   ./phantom dev"
  echo "    Con Docker:   instala Docker Desktop y PHANTOM_MODE=docker ./phantom install"
  echo "============================================================"
}

phantom_catalog_export_native() {
  phantom_cd_root
  local py="python3"
  if [[ -x backend/.venv/bin/python ]]; then
    py=".venv/bin/python"
  fi
  if [[ -f backend/.env ]]; then
    set -a
    # shellcheck disable=SC1091
    source backend/.env
    set +a
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[!] Falta DATABASE_URL en backend/.env" >&2
    echo "    Ejemplo (Postgres local en macOS):" >&2
    echo "    DATABASE_URL=postgresql+psycopg2://postgres:TU_PASS@127.0.0.1:5432/katana_security_db" >&2
    exit 1
  fi
  export PYTHONPATH="${PHANTOM_ROOT}/backend"
  echo "[*] Export nativo → backend/catalog/ (DATABASE_URL desde backend/.env)"
  (cd backend && "$py" -m scripts.export_operational_catalog "$@")
}
