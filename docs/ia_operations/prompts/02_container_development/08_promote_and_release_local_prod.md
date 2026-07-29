# PROMPT: 08_promote_and_release_local_prod (Contenedores)
**Rol**: SRE / Tech Lead
**Objetivo**: Promover imágenes verificadas a producción contenerizada local y aplicar migraciones efímeras de esquema.
**Capa de Arquitectura**: Persistencia / Docker Compose Prod.

## Instrucciones para la IA
1. Construir las imágenes con tags oficiales (`docker compose -f docker-compose.prod.yml build`).
2. Levantar el stack de producción local (`docker compose -f docker-compose.prod.yml up -d`).
3. Ejecutar migraciones automáticas dentro del contenedor durante la fase de bootstrap.
