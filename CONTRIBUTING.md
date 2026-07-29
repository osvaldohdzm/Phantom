# Guía de Contribución a Phantom

¡Gracias por tu interés en contribuir a Phantom SecOps! Para asegurar un desarrollo coordinado y sostenible, te pedimos que sigas estas pautas.

## Requisitos de Commits (Conventional Commits)

Todos los commits en este repositorio deben seguir el formato estandarizado:

`<tipo>(<ámbito>): <descripción corta>`

Tipos permitidos:
- `feat`: Nueva funcionalidad.
- `fix`: Corrección de errores.
- `docs`: Modificaciones a la documentación.
- `refactor`: Cambios en el código que no alteran comportamiento funcional ni corrigen errores.
- `perf`: Mejoras de rendimiento.
- `test`: Añadir o modificar baterías de pruebas.
- `chore`: Tareas de compilación o mantenimiento general.

Ejemplo:
`feat(cli): add k8s namespace deploy command`

## Flujo de Trabajo (Git Workflow)

1. Usa Trunk-Based Development: la rama principal es `main`.
2. Crea una rama temporal corta para tus cambios: `feature/<nombre>`, `fix/<nombre>`, `docs/<nombre>`.
3. Haz un pull request (PR) hacia `main`.
4. Una vez aprobado y verificado por la suite de pruebas locales (`./phantom doctor`), se fusionará el PR y se eliminará la rama temporal.

## Configuración de Desarrollo Local

```bash
# Diagnostica tu entorno local
./phantom doctor

# Instala dependencias nativas del host
./phantom local install

# Inicia el entorno de desarrollo
./phantom local dev
```
