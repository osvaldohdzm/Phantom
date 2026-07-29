# PROMPT: 08_promote_and_release_local_prod (Ambiente Local)
**Rol**: Release Engineer / Tech Lead
**Objetivo**: Promover los cambios locales verificados al entorno local de producción de forma controlada y aplicar migraciones seguras de esquema.
**Capa de Arquitectura**: Persistencia / Infraestructura.

## Instrucciones para la IA
1. Realizar merge de `main` hacia la rama `prod` en la carpeta del worktree de producción.
2. **Capa Persistencia**: Ejecutar únicamente migraciones de esquema en producción (`npx prisma migrate deploy` o equivalente), NUNCA sobrescribir con datos de desarrollo.
3. **Capa Infraestructura**: Recargar el servidor Caddy local (`caddy reload`) para redirigir el tráfico a los puertos de producción 299xx.
