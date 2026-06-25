# Catálogo operativo (`core.vulns_catalog`)

Base de datos de vulnerabilidades unificada (CFR / Nessus Plugin ID, textos ES+EN, remediación, etc.) que alimenta la ingesta y los hallazgos.

## Export nativo (macOS / Postgres local, sin Docker)

1. Crea `backend/.env` (no lo commitees si tiene contraseña real):

```bash
cat > backend/.env <<'EOF'
DATABASE_URL=postgresql+psycopg2://postgres:TU_PASSWORD@127.0.0.1:5432/katana_security_db
JWT_SECRET=dev-local-only-change-me
AUTH_REQUIRED=false
EOF
```

2. Instala dependencias Python (una vez):

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

3. Exporta (lee `core.vulns_catalog` de tu BD pgAdmin):

```bash
./phantom catalog-export --native
```

Genera `backend/catalog/operational-catalog.csv.gz` + `manifest.json` (revisión +1 automática).

## Flujo para mantenedores

1. **Alimenta el catálogo** en tu Phantom local (UI *Catálogo operativo* → importar CSV, o edición manual).
2. **Exporta al repo**:
   ```bash
   ./phantom catalog-export
   # o con etiqueta explícita:
   ./phantom catalog-export v2026.06.1
   ```
   Genera o **sobrescribe** `operational-catalog.csv.gz` + `manifest.json` (versión, revisión incremental, SHA256, nota).
3. **Commit y push**:
   ```bash
   git add backend/catalog/
   git commit -m "Update operational vulnerability catalog v2026.06.1"
   git push
   ```

## Flujo para clientes / servidores

Tras `git pull` y reinicio del API:

```bash
./phantom update
# o
docker compose up -d --build api
```

El contenedor `api` compara `manifest.json` con la versión instalada en `core.vulns_catalog_meta`. Si hay una revisión más nueva (o la tabla está vacía), importa el CSV automáticamente.

Forzar reimportación:

```bash
PHANTOM_CATALOG_FORCE_IMPORT=1 docker compose up -d --force-recreate api
```

O manualmente:

```bash
./phantom catalog-import
```

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `manifest.json` | Versión, revisión, SHA256, nombre del CSV |
| `operational-catalog.csv.gz` | Dump comprimido (versionar en git; usar Git LFS si supera ~50 MB) |

## Variables de entorno

| Variable | Efecto |
|----------|--------|
| `PHANTOM_SKIP_CATALOG_SEED=1` | No importar catálogo al arrancar |
| `PHANTOM_CATALOG_FORCE_IMPORT=1` | Reimportar aunque la versión coincida |

## Notas

- La ingesta Nessus enriquece hallazgos por `NessusPluginId` contra esta tabla.
- Si el catálogo no está cargado, la ingesta sigue funcionando pero crea entradas nuevas desde el escáner.
- No commitear datos de tenant (`findings`, branding); solo `backend/catalog/`.
