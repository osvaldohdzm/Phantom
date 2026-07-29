# PROMPT: 08_promote_and_release_local_prod (Nube)
**Rol**: Release Engineer / Cloud Tech Lead
**Objetivo**: Promover la versión estable y ejecutar migraciones de esquema en la base de datos de producción RDS a través de K8s Jobs.
**Capa de Arquitectura**: Persistencia / Cloud Deploy.

## Instrucciones para la IA
1. Disparar el pipeline de CD para aplicar los cambios de IaC (Terraform Apply) o desplegar Helm Charts en producción.
2. **Capa Persistencia**: Lanzar un Kubernetes Job efímero para ejecutar las migraciones de base de datos en la instancia RDS de producción (nunca sobrescribir datos).
3. **Capa Edge/Red**: Ejecutar pruebas de carga rápida (Smoke Tests) en el subdominio productivo.
