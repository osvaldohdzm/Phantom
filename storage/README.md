# Datos de runtime (no versionar contenido; solo estructura)

- `uploads/` — subidas locales de desarrollo (producción: volumen Docker `phantom_storage`)
- `backups/` — respaldos locales opcionales (`./phantom backup` puede usar otra ruta)
- `logs/` — logs locales si no usas solo `docker compose logs`

En producción, PostgreSQL y `backend/storage` viven en volúmenes Docker.
