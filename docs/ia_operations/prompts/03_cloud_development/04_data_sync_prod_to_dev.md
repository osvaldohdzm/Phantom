# PROMPT: 04_data_sync_prod_to_dev (Nube)
**Rol**: Data Engineer
**Objetivo**: Sincronizar un snapshot anonimizado de la base de datos RDS / Cloud SQL de producción a un sandbox seguro de desarrollo.
**Capa de Arquitectura**: Persistencia / Cloud DB.

## Instrucciones para la IA
1. Solicitar la creación de un snapshot temporal de base de datos RDS.
2. Ejecutar script de anonimización (sanitización de datos sensibles de usuarios).
3. Restaurar la base de datos anonimizada en el entorno sandbox de desarrollo Cloud.
