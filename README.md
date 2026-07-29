# Phantom SecOps

Plataforma de gestión de vulnerabilidades y ciclo de vida de servicios de seguridad (AV/Infra, Pentest, DAST, SAST): ingesta masiva (Nessus/CSV), catálogo operativo, matriz CYB001, repositorio global y exportación a Word.

---

## Inicio rápido (Ubuntu Server — Docker)

**Requisitos:** Ubuntu 22.04 / 24.04, acceso `sudo`, puerto **3000** libre.

```bash
git clone [https://github.com/osvaldohdzm/Phantom.git](https://github.com/osvaldohdzm/Phantom.git)
cd Phantom
sudo ./scripts/install-ubuntu.sh

```

1. Abre **`https://<IP-del-servidor>:3000`** en tu navegador.
2. Si aparece una advertencia de certificado autofirmado, selecciona **Avanzado → Aceptar riesgo y continuar**.

> **¿Problemas de conexión?** Si el navegador muestra `PR_CONNECT_RESET_ERROR`, ejecuta en el servidor:
> ```bash
> ./phantom docker fix
> 
> ```
> 
> 
> *Esto regenerará el certificado con la IP del host y abrirá el puerto en `ufw` si aplica.*

### Credenciales por defecto

| Campo | Valor por defecto |
| --- | --- |
| **Usuario** | `phantom` |
| **Contraseña** | `phantom` |

> **Nota de Seguridad:** Al iniciar sesión por primera vez, el sistema exigirá cambiar la contraseña (mínimo 12 caracteres, mayúsculas, números y símbolos). También puedes actualizarla desde la terminal con:
> ```bash
> ./phantom local passwd
> 
> ```
> 
> 

---

## Desarrollo Local y Flujo Operativo (macOS / Linux)

### 1. Migración de Base de Datos Local a Docker

Si deseas migrar tu instancia PostgreSQL nativa local a un contenedor Docker con almacenamiento persistente local (en `./postgres-data`):

```bash
./phantom migrate

```

### 2. Flujo de Desarrollo Híbrido (Recomendado ⚡)

Corre la base de datos y la caché en Docker, y ejecuta la app nativamente con **Hot-Reloading**:

```bash
# 1. Inicia Postgres y Redis en Docker
./phantom docker start

# 2. Levanta la app nativa en caliente (Frontend + Backend)
./phantom local dev

```

### 3. Flujo 100% Docker (Producción / Pruebas de Stack Completo)

Levanta toda la arquitectura en contenedores:

```bash
# Iniciar todo el stack en Docker
./phantom docker start

# Ver logs en tiempo real (todos o filtrados por servicio)
./phantom docker logs
./phantom docker logs web
./phantom docker logs api

# Reiniciar o detener el stack
./phantom docker restart
./phantom docker stop

```

### 4. Diagnóstico y Salud del Sistema

Analiza sockets ocupados, puertos, disponibilidad de Redis y archivo `.env`:

```bash
./phantom doctor

```

---

## CLI de Phantom (`./phantom`)

La plataforma utiliza un CLI estructurado por **namespaces**: `./phantom <namespace> <subcomando>`

### Comandos Principales por Namespace

| Namespace | Subcomando | Descripción |
| --- | --- | --- |
| **`local`** | `dev` | Ejecuta el entorno de desarrollo con HTTPS + Hot-Reloading. |
|  | `prod` | Ejecuta el servidor local en modo producción. |
|  | `start` / `stop` | Inicia o detiene los procesos locales en segundo plano. |
|  | `install` | Instala dependencias de Python y Node.js en el host. |
|  | `passwd` | Cambia las credenciales del usuario Administrador. |
|  | `clean` | Limpia archivos temporales, cachés y builds. |
|  | `sbom` | Genera reporte SBOM de dependencias. |
| **`docker`** | `start` | Levanta el stack completo de Docker Compose (`postgres`, `redis`, `api`, `web`). |
|  | `stop` | Detiene los contenedores del stack conservando datos. |
|  | `restart [svc]` | Reinicia todos los contenedores o uno específico (ej. `web`, `api`). |
|  | `logs [svc]` | Muestra logs en tiempo real. |
|  | `build` | Reconstruye las imágenes de Docker. |
|  | `fix` | Regenera certificados TLS para la IP del host y ajusta cortafuegos (UFW). |
| **`doctor`** | *(directo)* | Ejecuta diagnóstico completo de salud del sistema, red y dependencias. |
| **`docs`** | `serve` | Inicia el portal interactivo de documentación en `http://localhost:8080`. |
|  | `generate` | Recompila el índice de documentación. |
| **`backup`** | *(directo)* | Crea un snapshot completo de la base de datos y archivos subidos. |
| **`restore`** | *(directo)* | Restaura un snapshot de base de datos y almacenamiento. |
| **`migrate`** | *(directo)* | Ejecuta la migración de base de datos local hacia el contenedor Docker. |

> Ver todos los atajos disponibles en el `Makefile` ejecutando `make help`.

---

## Estructura del Proyecto

| Ruta | Descripción |
| --- | --- |
| `src/` | Frontend en Next.js (App Router). |
| `backend/app/` | API backend basada en FastAPI. |
| `ops/` | Lógica interna y fuente de verdad del CLI (`./phantom`). |
| `docker-compose.yml` | Orquestación de PostgreSQL + Redis + API + Web. |
| `scripts/` | Scripts de instalación para Ubuntu, TLS y utilidades. |
| `storage/` | Almacenamiento local para subidas, respaldos y logs. |
| `docs/` | Manuales técnicos y documentación de arquitectura. |

---

## Variables de Entorno

Copia `.env.example` a `.env` antes de iniciar el sistema.

**Obligatorias en producción:**

* `POSTGRES_PASSWORD`
* `JWT_SECRET`
* `GEMINI_API_KEY` *(Opcional: la funcionalidad de IA se degradará si no está presente)*

Consulta [`docs/DEPLOYMENT.md`](https://www.google.com/search?q=./docs/DEPLOYMENT.md) para más detalles sobre Proxy Inverso, Hardening y Respaldos.

---

## Licencia

Consulte el archivo [LICENSE](https://www.google.com/search?q=./LICENSE) para más información.