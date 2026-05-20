# Manual de API — Spectra SecOps (v0.1)

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
| GET | `/api/v1/findings` | Lista hallazgos (`skip`, `limit`). |
| POST | `/api/v1/findings` | Crea hallazgo normalizado. |
| POST | `/api/v1/findings/{finding_id}/ai-enrich` | Enriquecimiento IA (LangChain). Cuerpo opcional para sobreescribir `raw_tool_output` / contexto. |

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

## Próximos endpoints

- `POST /api/v1/ingest/nessus` — subida XML y job async.
- `POST /api/v1/dedupe` — deduplicación batch.
- `GET /api/v1/exports/vulnerability-tracker.xlsx` — matriz cliente.

Documentación interactiva: `http://127.0.0.1:8000/docs` (OpenAPI).
