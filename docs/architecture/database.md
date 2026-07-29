# Diccionario de datos — Phantom SecOps

Definiciones alineadas a las hojas Excel de referencia y al esquema implementado en PostgreSQL (tablas en snake_case).

## `assets` (Activos / inventario)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único. |
| `nombre` | texto | Nombre legible del activo (hostname, rol). |
| `ip_publica` | texto | IPv4/IPv6 pública si aplica. |
| `ip_privada` | texto | IP en red interna. |
| `fqdn` | texto | Nombre DNS completamente calificado. |
| `criticidad` | texto | Clasificación de negocio (ej. Alta/Media). |
| `ambiente` | enum | `Prod` \| `Dev` — separación operativa. |

## `findings` (Hallazgos — Vulnerabilidades internas/externas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador del hallazgo normalizado. |
| `titulo` | texto | Título unificado (post-normalización). |
| `descripcion` | texto largo | Descripción técnica consolidada. |
| `severidad` | enum | `Critical` … `Info` — severidad operativa. |
| `cvss_score` | float | Puntuación CVSS (3.x). |
| `cvss_vector` | texto | Vector CVSS string. |
| `cve` | texto | Identificador CVE si existe. |
| `cwe` | texto | CWE relacionado. |
| `evidencia_url` | texto | URI a evidencia almacenada (S3, vault interno). |
| `status` | enum | Ciclo: Abierta → … → Riesgo aceptado (ver producto). |
| `raw_tool_output` | texto largo | Salida cruda de herramienta (Nessus/Nmap/etc.). |
| `explicacion_tecnica` | texto largo | Redacción profesional (IA + validación). |
| `amenaza_ampliada` | texto largo | Narrativa de impacto/escenario. |
| `owasp_category` | texto | Mapeo OWASP Top 10. |
| `mitre_technique_id` | texto | Técnicas MITRE ATT&CK (puede ser lista serializada). |
| `created_at` | timestamp | Auditoría de creación. |
| `asset_id` | UUID FK | Activo afectado (opcional). |
| `engagement_id` | UUID FK | Proyecto/pentest origen (opcional). |
| `catalog_id` | UUID FK | Entrada de catálogo estándar (opcional). |

## `core.vulnerabilities` (Catálogo de vulnerabilidades)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Id` | Serial/Int | Identificador primario. |
| `DefaultVulnerabilityName` | texto | Nombre base. |
| `Severity` | texto | Severidad asignada. |
| `Description` | texto | Descripción detallada. |
| `Danger` | texto | Amenaza / Impacto. |
| `Solution` | texto | Recomendación. |
| `CVE` / `CWE` | texto | Referencias estándares. |

## `engagements` (Evaluaciones / proyectos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador del engagement. |
| `cliente` | texto | Cliente o unidad de negocio. |
| `fecha_inicio` | fecha | Inicio contractual/técnico. |
| `fecha_fin` | fecha | Fin previsto o real. |
| `tipo` | enum | `Caja Negra` \| `Caja Gris` \| `Caja Blanca`. |

## `remediation_plan` (Seguimiento — Matriz / SLA)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador del plan de remediación. |
| `finding_id` | UUID FK | Hallazgo asociado. |
| `responsable` | texto | Owner en cliente o proveedor. |
| `fecha_compromiso` | fecha | Fecha objetivo de corrección. |
| `estado_remediacion` | texto | Estado detallado de remediación (texto libre o catálogo). |

## Extensiones futuras sugeridas

- `security_services`, `assignments`, `time_entries` para SEC-Services y hoja **Reportes**.
- `evidence_files`, `checklist_items` para PENT-Lifecycle (WSTG/MASTG/OSSTMM).
