#!/usr/bin/env bash
# Instala Docker (o Podman) en Ubuntu Server y levanta Phantom SecOps.
# Uso:
#   curl -fsSL .../install-ubuntu.sh | bash
#   o desde el repo clonado:
#   sudo ./scripts/install-ubuntu.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[!] Ejecuta con sudo: sudo $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "============================================================"
echo " Phantom SecOps — instalación Ubuntu"
echo "============================================================"

apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl make

# Docker Engine (oficial)
if ! command -v docker &>/dev/null; then
  echo "[*] Instalando Docker Engine…"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

# Usuario que invocó sudo (para grupo docker)
SUDO_USER="${SUDO_USER:-$USER}"
if id "$SUDO_USER" &>/dev/null; then
  usermod -aG docker "$SUDO_USER" 2>/dev/null || true
fi

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  # Generar secretos aleatorios
  if command -v openssl &>/dev/null; then
    PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    JWT=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
    sed -i "s/change_me_strong_password/${PW}/" "$ROOT/.env"
    sed -i "s/change_me_jwt_secret_min_32_chars/${JWT}/" "$ROOT/.env"
    echo "[+] Secretos generados en .env"
  else
    echo "[!] Edita .env: POSTGRES_PASSWORD y JWT_SECRET"
  fi
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
if ! grep -qE '^PHANTOM_TLS_SANS=' "$ROOT/.env" 2>/dev/null; then
  echo "PHANTOM_TLS_SANS=localhost,127.0.0.1,${IP}" >> "$ROOT/.env"
  echo "[+] PHANTOM_TLS_SANS=localhost,127.0.0.1,${IP}"
fi

echo "[*] Construyendo y arrancando contenedores (primera vez puede tardar varios minutos)…"
cd "$ROOT"
docker compose up -d --build

PORT=$(grep -E '^PHANTOM_HTTP_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2 || echo 3000)
PORT=${PORT:-3000}

# Firewall: abrir puerto si ufw está activo
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -qi 'Status: active'; then
  ufw allow "${PORT}/tcp" comment 'Phantom SecOps web' >/dev/null 2>&1 || true
  echo "[+] Regla ufw: allow ${PORT}/tcp"
fi

echo "[*] Comprobando HTTPS local…"
VERIFY_OK=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -kfsS "https://127.0.0.1:${PORT}/" -o /dev/null 2>/dev/null; then
    VERIFY_OK=1
    break
  fi
  sleep 3
done

echo ""
echo "============================================================"
echo " Phantom listo"
if [[ "$VERIFY_OK" -eq 1 ]]; then
  echo "   https://${IP}:${PORT}"
  echo "   https://localhost:${PORT}"
  echo ""
  echo "   El certificado es autofirmado: en el navegador acepta la"
  echo "   excepción de seguridad (Avanzado → continuar)."
else
  echo "   [!] El servicio web aún no responde en el puerto ${PORT}."
  echo "   Revisa: docker compose logs web"
  echo "   URL esperada: https://${IP}:${PORT}"
fi
echo "   Usuario: phantom  |  Contraseña: phantom (cambio obligatorio en primer login)"
echo ""
echo "   Cambiar credenciales: cd $ROOT && ./change.sh"
echo "   Logs: docker compose logs -f"
echo "   Parar: docker compose down"
echo "============================================================"
if [[ "$SUDO_USER" != "root" ]]; then
  echo "[*] Cierra sesión o ejecuta: newgrp docker"
fi
