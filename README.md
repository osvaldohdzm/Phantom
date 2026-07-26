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

Cambiar credenciales desde servidor: `./phantom change`

## Desarrollo local & Flujo Operativo (macOS / Linux)

### 1. Migración de Base de Datos Local a Docker
Si vienes de tener PostgreSQL instalado de forma nativa en tu Mac/Linux y deseas migrar todos tus datos y esquemas a un contenedor Docker de manera profesional y persistente (con almacenamiento físico local ignorado de git en `./postgres-data`), utiliza el script automatizado:
```bash
# Detiene el servicio de macOS, inicia la base en Docker y restaura los datos con pg_restore
./migrate_db_to_docker.sh
```

### 2. Flujo de Desarrollo Híbrido (El más rápido ⚡)
Para evitar la reconstrucción de contenedores de Next.js (`next build`) en cada cambio, te recomendamos correr la base de datos y caché en Docker, y la aplicación de forma nativa en caliente:
```bash
# 1. Inicia solo Postgres y Redis en Docker
docker compose up -d postgres redis

# 2. Levanta la aplicación en caliente (Hot-Reloading activo en frontend y backend)
./phantom dev
```
Cualquier cambio que realices en el código frontend (Next.js) o backend (FastAPI) se reflejará en **milisegundos** en tu navegador sin reconstrucciones.

### 3. Flujo en Docker (Producción / Pruebas completas)
Si deseas levantar toda la arquitectura empaquetada (Web, API, Ingestor Go, Parser Rust, Postgres, Redis) en contenedores de producción local:
```bash
# Iniciar todo el stack en Docker (con validación de entorno)
./start.sh   # O equivalentemente: ./phantom start

# Detener todos los servicios conservando datos persistentes
./phantom stop

# Ver logs en tiempo real (puedes filtrar por servicio, ej: web, api)
./phantom logs       # Todos los logs
./phantom logs web   # Solo logs de la interfaz
./phantom logs api   # Solo logs de la API

# Reiniciar un servicio específico sin recompilar el resto
./phantom restart web
./phantom restart api
```

### 4. Diagnóstico y Depuración
Si tienes conflictos de puertos o problemas de red en tu sistema, usa la suite de diagnóstico:
```bash
./phantom debug
```
Este comando analizará sockets ocupados, reenvíos de Docker, disponibilidad de Redis y la integridad del archivo de entorno `.env`.

---

## Comandos Completos del CLI (`./phantom`)
La plataforma expone un CLI unificado para controlar todas las operaciones a través de `./phantom <comando>`:

| Comando | Descripción |
|---------|-------------|
| `./phantom install` | Prepara el entorno `.env` y construye todas las imágenes de Docker. |
| `./phantom start` | Levanta el stack completo de Docker en modo producción/HTTPS (`./start.sh`). |
| `./phantom stop` | Apaga el stack completo de Docker sin eliminar datos persistentes. |
| `./phantom restart [svc]` | Reinicia todos los contenedores o uno en específico (ej. `web`, `api`). |
| `./phantom logs [svc]` | Muestra logs en tiempo real. Soporta filtrar por servicio individual. |
| `./phantom health` | Realiza un chequeo de salud contra los endpoints de la API y el portal. |
| `./phantom update` | Realiza un `git pull` automatizado, reconstruye imágenes y reinicia el stack. |
| `./phantom dev` | Inicia el frontend y backend nativos con TLS y hot-reloading. |
| `./phantom prod` | Inicia el backend y frontend nativos en modo producción (sin Docker). |
| `./phantom debug` | Inicia la suite de desarrollo local con diagnóstico de puertos y servicios. |
| `./phantom change` | Cambia las credenciales del usuario Administrador del portal. |
| `./phantom backup` | Realiza un respaldo completo de la base de datos y archivos subidos. |
| `./phantom clean` | Limpia archivos temporales, cachés de compilación y dumps locales. |
| `./phantom sbom` | Genera análisis de SBOM y escaneo de vulnerabilidades de dependencias. |
| `./phantom fix-docker` | Regenera certificados TLS para la IP del host y ajusta cortafuegos (UFW). |

Ver todos los atajos en `Makefile` ejecutando `make help`. Detalle técnico en [`ops/README.md`](./ops/README.md) y [`docs/architecture/repository-layout.md`](./docs/architecture/repository-layout.md).


## Estructura

| Ruta | Descripción |
|------|-------------|
| `src/` | Frontend Next.js (App Router) |
| `backend/app/` | API FastAPI |
| `docker-compose.yml` | Stack PostgreSQL + Redis + API + Web |
| `infra/docker/` | Dockerfiles (`api.Dockerfile`, `web.Dockerfile`) |
| `ops/` | Operaciones — fuente de verdad (`./phantom …`) |
| `scripts/` | Setup Ubuntu, TLS, entrypoints Docker |
| `storage/` | Datos runtime locales (uploads, backups, logs) |
| `docs/` | Manual técnico y arquitectura |
| `Makefile` | Atajos (`make start`, `make update`, …) |

## Variables de entorno

Copia `.env.example` → `.env`. Obligatorias en producción:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `GEMINI_API_KEY` (opcional; IA degradada sin clave)

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para reverse proxy, backups y hardening.

## Licencia

Ver [LICENSE](./LICENSE).
