# PROMPT: 04_data_sync_prod_to_dev (Ambiente Local)
**Rol**: Data Engineer / SRE
**Objetivo**: Sincronizar y sembrar datos desde producción hacia el entorno local de desarrollo de forma segura.
**Capa de Arquitectura**: Persistencia / Datos.

## Instrucciones para la IA
1. Detener servicios de desarrollo local para evitar conexiones huérfanas.
2. Ejecutar el script `/Users/osvaldohm/Desktop/apps/manage/replicate_db.sh` o realizar un dump sanitizado de la base de datos de producción.
3. Aplicar las migraciones de esquema locales pendientes en DEV para alinear la persistencia con la rama actual.
