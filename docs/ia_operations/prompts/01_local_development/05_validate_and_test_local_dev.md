# PROMPT: 05_validate_and_test_local_dev (Ambiente Local)
**Rol**: Senior QA Engineer
**Objetivo**: Ejecutar suites de pruebas locales (Pytest y compilación Next.js) para certificar el código.
**Capa de Arquitectura**: Presentación / Aplicación.

## Instrucciones para la IA
1. Ejecutar las pruebas unitarias y de integración del backend con `PYTHONPATH=. .venv/bin/pytest tests`.
2. Validar compilación del frontend con `npm run build`.
3. Reportar los casos fallidos o advertencias críticas en logs.
