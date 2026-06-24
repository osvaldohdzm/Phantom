# Despliegue Phantom SecOps

## 1. Docker / Podman (recomendado)

### Instalación limpia en Ubuntu

```bash
git clone https://github.com/osvaldohdzm/Phantom.git /opt/phantom
cd /opt/phantom
sudo ./scripts/install-ubuntu.sh
```

El script instala Docker Engine, genera `.env` con secretos aleatorios y ejecuta `docker compose up -d --build`.

### Manual

```bash
cp .env.example .env
# Editar POSTGRES_PASSWORD, JWT_SECRET, GEMINI_API_KEY (opcional)
docker compose up -d --build
```

Servicios:

| Servicio | Rol | Puerto host |
|----------|-----|-------------|
| `postgres` | PostgreSQL 16 | interno |
| `redis` | Cache / colas | interno |
| `api` | FastAPI (Uvicorn) | interno |
| `web` | Next.js HTTPS | `3000` (configurable) |

Datos persistentes:

- `pgdata` — base de datos
- `phantom_storage` — plantillas Word, branding, reportes (`backend/storage`)

### Podman

```bash
podman compose up -d --build
```

### Operación

```bash
docker compose logs -f api web
docker compose restart
docker compose down          # conserva volúmenes
docker compose down -v       # borra BD y storage (¡cuidado!)
```

### Cambiar contraseña admin

Con stack Docker en marcha:

```bash
docker compose exec api python -m scripts.change_credentials
```

O en instalación nativa: `./change.sh`

---

## 2. Desarrollo / producción nativa (sin contenedor app)

### Requisitos

- Node.js 22+
- Python 3.11+
- PostgreSQL 16 + Redis 7
- `mkcert` (HTTPS local)

### Base de datos

```bash
docker compose up -d postgres redis
cp backend/.env.example backend/.env
```

### Certificados

```bash
./scripts/generate-certs.sh
# IPs extra (Tailscale/LAN):
CERT_EXTRA_HOSTS="100.x.x.x 192.168.0.10" ./scripts/generate-certs.sh
```

### Arranque

| Modo | Comando | Notas |
|------|---------|-------|
| Desarrollo | `./start-dev.sh` | Hot-reload, HTTPS :3000 |
| Producción | `./start-prod.sh` | Build Next + workers Uvicorn |

---

## 3. Reverse proxy (HTTPS público)

Phantom en Docker usa certificado autofirmado en `:3000`. En producción expón detrás de **Caddy** o **nginx** con Let's Encrypt:

```caddy
phantom.example.com {
  reverse_proxy https://127.0.0.1:3000 {
    transport http {
      tls_insecure_skip_verify
    }
  }
}
```

O termina TLS en el proxy y reenvía HTTP a un listener HTTP (requiere ajustar `server-prod.mjs` / usar `next start` en HTTP).

---

## 4. Seguridad

1. Tras el primer login con `phantom` / `phantom`, la UI obliga a definir una contraseña robusta.
2. Cambia credenciales desde servidor cuando quieras: `./change.sh` (misma política).
3. Usa `JWT_SECRET` y `POSTGRES_PASSWORD` fuertes (`.env` nunca en git).
3. Restringe el puerto 3000 con firewall (`ufw allow from 10.0.0.0/8 to any port 3000`).
4. `AUTH_REQUIRED=true` en producción.
5. Backups periódicos del volumen `pgdata`:

```bash
docker compose exec postgres pg_dump -U phantom katana_security_db > backup.sql
```

---

## 5. Qué no va en el repositorio

| Excluido | Motivo |
|----------|--------|
| `.env`, `backend/.env` | Secretos |
| `node_modules`, `.next`, `.venv` | Artefactos de build |
| `certificates/*.pem` | TLS local |
| `backend/storage/branding`, `reports`, plantillas `.docx` | Datos de tenant |
| `uploads/` | Cargas temporales |

Plantillas Word se suben desde la UI o se restauran en `backend/storage/templates/`.

---

## 6. Solución de problemas

| Síntoma | Acción |
|---------|--------|
| `Auth seed: UniqueViolation` | Actualiza a última versión; seed es idempotente |
| Puerto 3000 ocupado | `PHANTOM_HTTP_PORT=3443` en `.env` |
| API no responde | `docker compose logs api` — esperar healthcheck Postgres |
| Matriz lenta (60k+ filas) | Normal en primera carga; usa filtros de severidad |
| LibreSSL warning (macOS) | Inofensivo en dev con Python 3.9 |

---

## 7. Actualizar

```bash
cd /opt/phantom
git pull
docker compose up -d --build
```
