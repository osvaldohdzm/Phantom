# PROMPT: 04_data_sync_prod_to_dev (Contenedores)
**Rol**: Data Engineer
**Objetivo**: Sincronizar datos productivos dentro del volumen de la base de datos contenerizada local de desarrollo.
**Capa de Arquitectura**: Persistencia / Docker Volumes.

## Instrucciones para la IA
1. Detener temporalmente los contenedores del API y Frontend.
2. Ejecutar dump de datos al contenedor de base de datos PostgreSQL (`docker compose exec -T db pg_restore ...`).
3. Ejecutar las migraciones locales dentro del contenedor de base de datos.
