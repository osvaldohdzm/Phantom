# Docker (infra)

Imágenes y definición del stack Phantom.

| Archivo | Uso |
|---------|-----|
| `api.Dockerfile` | FastAPI + Uvicorn |
| `web.Dockerfile` | Next.js producción + proxy HTTPS |

El compose activo está en la raíz: `docker-compose.yml` (contexto de build = raíz del repo).

Entrypoints y TLS en `scripts/docker-entrypoint-*.sh` y `scripts/docker-generate-tls.sh`.
