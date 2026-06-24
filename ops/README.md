# Operaciones Phantom (`ops/`)

Scripts esenciales para instalar, arrancar, actualizar, respaldar y mantener Phantom.

**Punto de entrada recomendado** (desde la raíz del repo):

```bash
./phantom help
# o
make help
```

```bash
./phantom install
./phantom start
./phantom update          # git pull + build + recreate
./phantom health
```

Los scripts sueltos en `ops/*.sh` son implementación interna; no dupliques lógica en la raíz del repo.

## Docker / servidor

| Comando | Script | Descripción |
|---------|--------|-------------|
| `./phantom install` | `install.sh` | `.env`, secretos, build imágenes |
| `./phantom install --system` | → `scripts/install-ubuntu.sh` | Docker en Ubuntu (sudo) |
| `./phantom start` | `start.sh` | `docker compose up -d --build` |
| `./phantom stop` | `stop.sh` | Detener (conserva volúmenes) |
| `./phantom restart` | `restart.sh` | Reiniciar servicios |
| `./phantom update` | `update.sh` | Actualizar despliegue |
| `./phantom build` | `build.sh` | Solo build imágenes |
| `./phantom logs` | `logs.sh` | Logs en vivo |
| `./phantom health` | `healthcheck.sh` | Web + API |
| `./phantom backup` | `backup.sh` | Dump PostgreSQL + storage |
| `./phantom verify-env` | `verify-env.sh` | Validar `.env` |
| `./phantom clean` | `clean.sh` | Limpiar `.next`, cachés |
| `./phantom uninstall` | `uninstall.sh` | Desinstalar |

## Base de datos y catálogo

| Comando | Descripción |
|---------|-------------|
| `./phantom change` | Credenciales admin |
| `./phantom catalog-export vX.Y` | Exportar `core.vulns_catalog` → `backend/catalog/` |
| `./phantom catalog-import` | Importar catálogo empaquetado (tras `git pull`) |

## Desarrollo nativo

| Comando | Script | Descripción |
|---------|--------|-------------|
| `./phantom dev` | `dev.sh` | HTTPS + hot-reload |
| `./phantom prod` | `prod.sh` | Producción sin Docker app |
| `./phantom native` | `native.sh` | Nativo (también `PHANTOM_MODE=native ./phantom start`) |
| `./phantom debug` | `debug.sh` | Dev + diagnóstico de puertos |

## Infraestructura (permanece en `scripts/`)

| Script | Uso |
|--------|-----|
| `scripts/install-ubuntu.sh` | Instalación limpia Ubuntu |
| `scripts/fix-docker-access.sh` | TLS + firewall |
| `scripts/generate-certs.sh` | Certificados mkcert (dev) |
| `scripts/docker-entrypoint-*.sh` | Entrypoints Docker (no ejecutar a mano) |

## Librería compartida

`ops/lib.sh` — helpers (`phantom_compose`, `phantom_print_urls`, …).  
`scripts/phantom-lib.sh` reexporta `ops/lib.sh` por compatibilidad.
