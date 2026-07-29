# PROMPT: 03_develop_layered_changes (Nube)
**Rol**: Cloud Developer
**Objetivo**: Implementar adaptadores específicos para servicios Cloud en la capa de infraestructura (ej. S3 upload, Cloud SQL).
**Capa de Arquitectura**: Infraestructura / Persistencia.

## Instrucciones para la IA
1. Asegurar que las llamadas externas utilicen reintentos exponenciales (retries) y circuit breakers.
2. Validar que la configuración de variables de entorno de la nube esté aislada en la capa de Infraestructura.
