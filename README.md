# Phantom SecOps

Plataforma de gestión de vulnerabilidades y ciclo de vida de servicios de seguridad (AV/Infra, pentest, DAST, SAST): ingesta masiva (Nessus/CSV), catálogo operativo, matriz CYB001, repositorio global y exportación Word.

## Inicio rápido (Ubuntu Server — Docker)

Requisitos: Ubuntu 22.04/24.04, acceso `sudo`, puerto **3000** libre.

```bash
git clone https://github.com/osvaldohdzm/Phantom.git
cd Phantom
sudo ./scripts/install-ubuntu.sh
```

Abre **https://&lt;IP-del-servidor&gt;:3000** (certificado autofirmado → **Avanzado → aceptar riesgo y continuar**).

Si el navegador muestra `PR_CONNECT_RESET_ERROR`, en el servidor ejecuta:

```bash
sudo ./scripts/fix-docker-access.sh
```

Eso regenera el certificado con la IP del host, abre el puerto en `ufw` si aplica y verifica con `curl`.

| Campo        | Valor por defecto |
|-------------|-------------------|
| Usuario     | `phantom`         |
| Contraseña  | `phantom`         |

**Primer inicio de sesión:** el sistema exige cambiar la contraseña con una política robusta (mín. 12 caracteres, mayúsculas, números y símbolos). No podrás usar la app hasta completar este paso.

Cambiar credenciales desde servidor: `./change.sh`

### Comandos habituales

```bash
cp .env.example .env          # si no existe
make up                       # levantar stack
make logs                     # ver logs
make down                     # parar
docker compose ps             # estado
```

Compatible con **Podman Compose** (`podman compose up -d --build`).

## Desarrollo local (macOS / Linux)

```bash
# 1. Base de datos
docker compose up -d postgres redis

# 2. Backend
cp backend/.env.example backend/.env   # ajustar DATABASE_URL
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Frontend
npm ci

# 4. Certificados TLS locales (mkcert)
brew install mkcert && mkcert -install   # macOS
./scripts/generate-certs.sh

# 5. Arrancar
./start-dev.sh
```

Producción nativa (sin Docker): `./start-prod.sh`

## Estructura

| Ruta | Descripción |
|------|-------------|
| `src/` | Frontend Next.js (App Router) |
| `backend/app/` | API FastAPI |
| `docker-compose.yml` | PostgreSQL + Redis + API + Web |
| `scripts/install-ubuntu.sh` | Instalación automatizada en Ubuntu |
| `docs/` | Manual técnico y API |

## Variables de entorno

Copia `.env.example` → `.env`. Obligatorias en producción:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `GEMINI_API_KEY` (opcional; IA degradada sin clave)

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para reverse proxy, backups y hardening.

## Licencia

Ver [LICENSE](./LICENSE).
