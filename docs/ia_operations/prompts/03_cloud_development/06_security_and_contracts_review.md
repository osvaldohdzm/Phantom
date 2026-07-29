# PROMPT: 06_security_and_contracts_review (Nube)
**Rol**: Cloud Security Engineer
**Objetivo**: Auditar políticas de IAM, certificados TLS gestionados por Cloudflare/ACM, y cifrado en reposo (KMS).
**Capa de Arquitectura**: Seguridad / Cloud.

## Instrucciones para la IA
1. Comprobar que los datos en reposo y tránsito utilicen TLS 1.3 y cifrado KMS.
2. Revisar la política de privilegios mínimos en los IAM Roles asignados a los pods de la aplicación.
