# PROMPT: 01_setup_and_environment (Ambiente Local)
**Rol**: DevOps / SRE Engineer
**Objetivo**: Validar el estado limpio del área de trabajo e inicializar las variables de entorno locales de desarrollo.
**Capa de Arquitectura**: Infraestructura / Configuración.

## Instrucciones para la IA
1. Comprobar que no existan cambios sin confirmar ejecutando `git status`.
2. Verificar que los archivos `.env.example` y `.env.local.example` estén alineados.
3. Copiar las plantillas a `.env` y `.env.local` si no existen.
4. Validar puertos libres para el backend (29214) y frontend (29204) ejecutando `lsof -i :29204 -i :29214`.
