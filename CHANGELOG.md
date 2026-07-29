# Historial de Cambios (Changelog) - Phantom

Todos los cambios notables en este proyecto serán documentados en este archivo basándose en Conventional Commits.

## [0.4.0] - 2026-07-28

### Added
- Nueva estructura organizativa separando código, despliegues (`deploy/`), especificaciones (`specs/`) y documentación (`docs/`).
- Portal de documentación técnica interactiva basado en Docsify y servido de forma local mediante `./phantom docs serve`.
- Espacios de nombres operativos en el CLI (`phantom local`, `phantom docker`, `phantom cluster`, `phantom docs`, `phantom plugin`).
- Diagnósticos y validación integral del host mediante `./phantom doctor`.
- Plantillas GitHub y pautas de gobernanza del repositorio.

### Changed
- Actualizados build context y rutas de montaje de volumen en `deploy/docker/docker-compose.yml`.
- Reubicados Dockerfiles a `deploy/docker/`.
- Reubicados manifiestos Kubernetes a `deploy/kubernetes/`.
