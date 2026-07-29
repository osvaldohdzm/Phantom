# Manual de API — Phantom SecOps (v0.1)

Base URL local: `http://127.0.0.1:8000`

## Convenciones

- Prefijo versionado: `/api/v1`.
- JSON UTF-8; errores en formato estándar FastAPI.
- Integración CI (Jenkins/GitLab): usar **token de servicio** (pendiente de implementar) y cabecera `Authorization: Bearer <token>`.

## Salud

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio. |

## Activos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/assets` | Lista inventario (paginación por evolución). |
| POST | `/api/v1/assets` | Crea activo. Cuerpo: `nombre`, `ip_publica`, `ip_privada`, `fqdn`, `criticidad`, `ambiente` (`Prod`/`Dev`). |

### Ejemplo `POST /api/v1/assets`

```json
{
  "nombre": "api-cliente.prod",
  "ip_publica": "203.0.113.10",
  "ip_privada": "10.0.4.22",
  "fqdn": "api.cliente.example",
  "criticidad": "Alta",
  "ambiente": "Prod"
}
```

## Hallazgos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/findings` | Lista hallazgos (`skip`, `limit`, `engagement_id`, filtros). |
| POST | `/api/v1/findings` | Crea hallazgo normalizado. |
| PATCH | `/api/v1/findings/{finding_id}` | Actualiza campos del hallazgo. |
| PATCH | `/api/v1/findings/{finding_id}/status` | Cambia estado del ciclo de vida. |
| POST | `/api/v1/findings/{finding_id}/ai-enrich` | Enriquecimiento **Gemini Engine (IA)**. Cuerpo opcional para sobreescribir `raw_tool_output` / contexto. |
| POST | `/api/v1/findings/deduplicate` | Deduplicación batch por `engagement_id` (query param). Elimina duplicados detectados. |
| POST | `/api/v1/findings/consolidate-master-catalog` | Consolida hallazgos en el catálogo maestro operativo (metadatos globales, fingerprint, `ai_group_id`). |
| POST | `/api/v1/findings/assign-ai-groups` | Asigna `ai_group_id` por título normalizado dentro de un engagement (heurística local, sin LLM). |
| POST | `/api/v1/findings/sync-from-catalog` | Sincroniza campos Esp* desde catálogo operativo. |

### Ejemplo `POST /api/v1/findings`

```json
{
  "titulo": "TLS 1.0 habilitado",
  "descripcion": "Servidor acepta protocolo obsoleto.",
  "severidad": "High",
  "cvss_score": 7.4,
  "cve": null,
  "cwe": "CWE-327",
  "raw_tool_output": "ssl-enum-ciphers: TLSv1.0: ...",
  "asset_id": null,
  "engagement_id": null,
  "catalog_id": null
}
```

### Ejemplo `POST /api/v1/findings/{id}/ai-enrich`

```json
{
  "raw_tool_output": "(opcional si ya está guardado en el finding)",
  "titulo": "(opcional)",
  "componente_afectado": "OpenSSL 1.0.2"
}
```

Respuesta incluye `explicacion_tecnica`, `amenaza_ampliada`, `owasp_top10`, `mitre_attack`, `sugerencia_remediacion` y `disclaimer`.

### Ejemplo `POST /api/v1/findings/deduplicate`

Query: `?engagement_id=<uuid>`

Respuesta: `{ "deleted_count": 3, "group_count": 2 }`

### Ejemplo `POST /api/v1/findings/consolidate-master-catalog`

```json
{
  "engagement_id": "uuid-del-proyecto"
}
```

O bien `{ "finding_ids": ["uuid-1", "uuid-2"] }`.

Respuesta: `{ "synced", "skipped", "total", "groups", "errors", "details" }`

### Ejemplo `POST /api/v1/findings/assign-ai-groups`

Query: `?engagement_id=<uuid>`

Respuesta: `{ "assigned": 12, "groups_created": 4 }`

## Ingesta

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/ingest/universal-csv` | Importa hallazgos desde CSV genérico (`file`, `engagement_id`, `column_map` opcional JSON). |
| POST | `/api/v1/ingest/nessus-csv` | Importa export CSV de Nessus. |
| POST | `/api/v1/ingest/acunetix-html` | Importa informe HTML de Acunetix. |
| POST | `/api/v1/ingest/nmap` | Importa salida Nmap. |

### Ejemplo `POST /api/v1/ingest/universal-csv`

`multipart/form-data`:

- `file`: archivo CSV
- `engagement_id`: UUID del proyecto (obligatorio)
- `column_map` (opcional): JSON `{"Título": "titulo", "Severidad": "severidad", ...}`

Respuesta: `{ "source": "universal-csv", "created_count", "finding_ids", "message", "column_map" }`

## Próximos endpoints

- `POST /api/v1/ingest/nessus` — subida XML y job async.
- `GET /api/v1/exports/vulnerability-tracker.xlsx` — matriz cliente.

Documentación interactiva: `http://127.0.0.1:8000/docs` (OpenAPI).
