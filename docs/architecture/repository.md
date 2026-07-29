# Estructura del repositorio

Phantom es una app **Next.js + FastAPI** con operación Docker real. Parte de la reorganización ya está hecha; el resto es roadmap por fases.

## Estado actual (después de Fase 1)

```text
phantom/
├── phantom              # CLI único → ops/phantom
├── Makefile             # make start | make update | …
├── docker-compose.yml   # stack (build → infra/docker/*.Dockerfile)
├── package.json         # app web (Next.js)
├── src/                 # frontend
├── backend/             # API Python
├── public/
├── infra/
│   └── docker/          # Dockerfiles + README
├── ops/                 # scripts operativos (fuente de verdad)
├── scripts/             # setup Ubuntu, TLS, entrypoints Docker
├── storage/             # uploads/backups/logs locales (gitignored)
├── certificates/        # TLS dev (gitignored)
├── docs/
│   └── architecture/    # este documento
├── tests/               # (objetivo) — hoy hay tests en backend/tests
└── README.md, DEPLOYMENT.md, AGENTS.md
```

### Ya resuelto

| Problema | Solución |
|----------|----------|
| Duplicación root vs `ops/` | **Una fuente de verdad:** `ops/` + `./phantom` |
| Demasiados `.sh` en raíz | Eliminados wrappers; usar `./phantom` o `make` |
| Docker mezclado con app | Dockerfiles en `infra/docker/` |
| Entrypoint operativo | `./phantom help` o `make help` |

### Convenciones

| Qué | Dónde |
|-----|--------|
| Desplegar / logs / backup | `./phantom …` o `make …` |
| Lógica de negocio web | `src/` |
| Lógica de negocio API | `backend/app/` |
| Imágenes Docker | `infra/docker/` |
| Instalar Ubuntu / TLS host | `scripts/` |
| Datos runtime locales | `storage/` |

## Fase 2 — `ops/` por dominio (próximo)

Reorganizar sin cambiar comandos ( `./phantom` sigue igual):

```text
ops/
├── phantom              # router
├── lib.sh
├── deploy/              # install, update, build
├── runtime/             # start, stop, restart, logs
├── maintenance/         # backup, clean, health, verify-env
├── development/         # dev, prod, native, debug
└── catalog/             # catalog-export, catalog-import
```

## Fase 3 — `scripts/` por responsabilidad

```text
scripts/
├── lib.sh               # reexport ops/lib.sh (compat)
├── setup/               # install-ubuntu, setup-embedded
├── docker/              # entrypoints, generate-tls, fix-access
├── tls/                 # generate-certs, load-cert-hosts (mkcert)
└── runtime/             # start-native
```

## Fase 4 — Monorepo explícito (opcional, gran cambio)

Solo si el equipo crece o CI exige separación estricta:

```text
apps/web/     # mover package.json, src/, next.config…
apps/api/     # mover backend/
```

Hoy **no** se recomienda: el coste de migración (Docker, imports, CI) es alto para poco beneficio inmediato.

## Fase 5 — Documentación

```text
docs/
├── architecture/        # diseño, este archivo
├── deployment/          # mover DEPLOYMENT.md
├── operations/          # runbooks (backup, recovery)
└── development/         # dev nativo, tests
```

## Qué no mover al repo

- `node_modules/`, `.next/`, `backend/.venv/`
- `certificates/*.pem`
- `storage/uploads/*`, dumps de BD
- Catálogo empaquetado versionado sí vive en `backend/catalog/` (datos operativos del producto)

## Comandos recomendados

```bash
# Servidor
./phantom install && ./phantom start
./phantom update
./phantom logs

# Equivalente Make
make install && make start
make update
make logs
```

## Referencias

- Operación día a día: `ops/README.md`
- Despliegue: `DEPLOYMENT.md`
- Agentes / IA: `AGENTS.md`
