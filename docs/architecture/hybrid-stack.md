# Arquitectura híbrida Phantom (Go + Rust + Python)

## Resumen

```text
Browser → Next.js (TS) → FastAPI (Python platform)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ingest-go       parse-rust      PostgreSQL
         (Go parsers)    (Rust fast)     + Redis jobs
              │               │
              └───────┬───────┘
                      ▼
              Python enrichment
              (catálogo, IA, persist)
```

| Capa | Runtime | Responsabilidad |
|------|---------|-----------------|
| **Plataforma** | Python (FastAPI) | Auth, multi-tenant, RBAC, CRUD, jobs, enrichment |
| **Ingest** | Go (`ingest-go`) | Parse Nessus CSV, Nmap XML/gnmap/text |
| **Fast path** | Rust (`parse-rust`) | Nessus targets-only masivo, dedup de componentes |
| **UI** | TypeScript (Next.js) | Dashboards, reporting |

## Servicios Docker

| Servicio | Puerto interno | Health |
|----------|----------------|--------|
| `api` | 8000 | `/health` |
| `ingest-go` | 8080 | `/health` |
| `parse-rust` | 8081 | `/health` |
| `redis` | 6379 | — |

## Cadena de parseo (fallback automático)

### Nessus CSV (hallazgos)
1. Go `POST /v1/parse/nessus-csv`
2. Python `parse_nessus_csv_bytes` (nativo)

### Nessus targets-only
1. Rust `POST /v1/parse/nessus-targets`
2. Go `POST /v1/parse/nessus-targets`
3. Python nativo

### Nmap
1. Go `POST /v1/parse/nmap?filename=scan.xml`
2. Python nativo

Si Go/Rust no están disponibles, **no se pierde funcionalidad**: el gateway usa Python.

## Ingesta asíncrona (Redis)

Archivos grandes (>5 MB por defecto) o `async_mode=true`:

- `POST /api/v1/ingest/nessus-csv` → devuelve `job_id`
- `GET /api/v1/ingest/jobs/{job_id}` → estado del job

El worker Python (dentro del contenedor `api`) procesa: parse → enrich → persist.

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `INGEST_GO_URL` | — | URL del sidecar Go |
| `PARSE_RUST_URL` | — | URL del servicio Rust |
| `INGEST_ASYNC_ENABLED` | `true` | Cola async para archivos grandes |
| `INGEST_WORKER_ENABLED` | `true` | Worker Redis en el API |
| `INGEST_ASYNC_MIN_BYTES` | `5242880` | Umbral async (5 MB) |
| `REDIS_URL` | `redis://localhost:6379/0` | Cola de jobs |

## Desarrollo nativo

```bash
# Terminal 1 — Go ingest
cd services/phantom-ingest && go run .

# Terminal 2 — Rust parse
cd services/phantom-parse && cargo run

# Terminal 3 — API (con URLs apuntando a localhost)
export INGEST_GO_URL=http://127.0.0.1:8080
export PARSE_RUST_URL=http://127.0.0.1:8081
cd backend && uvicorn app.main:app --reload
```

## Auditoría / banca

- Jobs guardan `file_sha256`, actor, tenant, timestamps
- Fallback Python garantiza continuidad operativa
- Binarios Go/Rust sin runtime en path crítico de parseo
- SBOM: generar en CI con `syft` sobre imágenes `ingest-go` y `parse-rust`

## API de diagnóstico

`GET /api/v1/ingest/stack` — estado de salud Go/Rust y URLs configuradas.
