# PROMPT: 05_validate_and_test_local_dev (Contenedores)
**Rol**: QA Automation
**Objetivo**: Validar el estado de salud de los contenedores de desarrollo ejecutando diagnósticos y pruebas de integración.
**Capa de Arquitectura**: Infraestructura / Healthcheck.

## Instrucciones para la IA
1. Comprobar el estado de salud de los contenedores (`docker compose ps`).
2. Validar que los healthchecks de PostgreSQL y Redis pasen con éxito.
3. Ejecutar pruebas automatizadas apuntando al host contenerizado.
