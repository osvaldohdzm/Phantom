# Supply chain — SBOM y vulnerabilidades

Phantom genera **Software Bill of Materials (SBOM)** para due diligence bancaria / ISO 27001 / SOC2.

## Componentes escaneados

| Componente | Ruta | Runtime |
|------------|------|---------|
| API platform | `backend/` | Python 3.11 |
| Ingest | `services/phantom-ingest/` | Go |
| Fast parse | `services/phantom-parse/` | Rust |
| Web | `package.json` (raíz) | Node 22 |

Opcional con `--images`: imágenes Docker `api`, `web`, `ingest-go`, `parse-rust`.

## Generar localmente

```bash
# Requiere syft (https://github.com/anchore/syft) o Docker
./phantom sbom

# Incluir imágenes Docker tras build
./phantom sbom --images

# Modo CI (falla si Grype encuentra Critical/High)
./phantom sbom --ci
```

Salida: `storage/sbom/` — archivos `*.spdx.json`, `*.cdx.json`, `*.grype.txt`.

## CI (GitHub Actions)

Workflow `.github/workflows/sbom.yml`:

- Se ejecuta en push/PR a `main` y manualmente (`workflow_dispatch`)
- Sube artefacto `phantom-sbom` (retención 90 días)
- Grype en modo advisory (`continue-on-error`) — revisar en PR checks

## Auditoría

Incluir en paquete de compliance:

1. SBOM SPDX del release (`api-backend-*.spdx.json`, etc.)
2. Reporte Grype del mismo timestamp
3. `manifest-*.json` con lista de componentes
4. Evidencia de `./phantom health` (Go/Rust operativos)

## Relacionado

- [Arquitectura híbrida](./hybrid-stack.md)
