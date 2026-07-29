# PROMPT: 06_security_and_contracts_review (Ambiente Local)
**Rol**: Security Engineer
**Objetivo**: Auditar el código buscando credenciales expuestas, configuraciones HTTPS y certificados TLS locales.
**Capa de Arquitectura**: Infraestructura / Edge.

## Instrucciones para la IA
1. Escanear cambios buscando claves API o contraseñas en texto plano.
2. Validar certificados locales HTTPS en `certificates/`.
3. Ejecutar análisis SBOM local (`./phantom local sbom`).
