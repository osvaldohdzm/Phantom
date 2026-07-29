# ADR 0001: Reorganización del Layout del Repositorio

* **Estado:** Aprobado
* **Fecha:** 2026-07-28
* **Autor:** Antigravity (Software Architect)

## Contexto

El repositorio de Phantom contenía configuraciones Docker, manifiestos de Kubernetes, documentación y especificaciones funcionales mezclados en el directorio raíz o en carpetas como `infra/` no normalizadas. A medida que el proyecto crece para convertirse en una plataforma de grado open-source con potencial monorepo, esta estructura plana o poco estructurada dificulta la contribución, el mantenimiento a largo plazo y la legibilidad del proyecto.

## Decisión

Hemos decidido reestructurar por completo el layout del repositorio para aislar las responsabilidades operacionales de las de aplicación. Los cambios principales son:

1. **Aislamiento de Despliegue (`deploy/`)**:
   - Crear una carpeta central `deploy/` que divide los entornos en `local/` (scripts nativos), `docker/` (compose y Dockerfiles) y `kubernetes/` (manifiestos unificados y futura integración Helm).
   - Eliminar el directorio `infra/` y los archivos sueltos como `docker-compose.yml` y `k8s-deployment.yaml` del directorio raíz.
   
2. **Especificaciones como Fuente de Verdad (`specs/`)**:
   - Agrupar en `specs/features/` y `specs/architecture/` las especificaciones que cualquier desarrollador humano o agente de Inteligencia Artificial (IA) debe leer antes de escribir código.
   
3. **Portal de Documentación Técnico (`docs/`)**:
   - Clasificar la documentación en carpetas bien definidas por audiencia: `getting-started/`, `architecture/`, `development/`, `operations/`, `cli/`, `adr/`, `roadmap/`.
   - Implementar Docsify a través de un index interactivo sin compilación, permitiendo servir un portal web completo con búsqueda integrada localmente con un comando.

## Consecuencias

### Positivas
- **Legibilidad:** El directorio raíz queda limpio, exponiendo solo el núcleo de la aplicación, el CLI de control y las configuraciones de gobernanza.
- **Escalabilidad:** Cada componente de despliegue, plugin o documentación tiene su espacio dedicado para crecer sin interferir con otros.
- **Preparación Monorepo:** Permite evolucionar el código de aplicación en `apps/` y `packages/` en fases futuras sin tener que reorganizar la infraestructura o documentación de nuevo.

### Negativas / Riesgos
- **Rutas Relativas:** Mover `docker-compose.yml` obligó a ajustar su contexto de construcción (`context: ../..`) y volúmenes de desarrollo (`../../postgres-data`), lo cual requiere un acoplamiento menor de las rutas en el archivo compose.
