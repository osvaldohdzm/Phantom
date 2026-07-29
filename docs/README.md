# Documentación Operativa y de Arquitectura de Phantom

Bienvenido al portal de documentación de la plataforma Phantom SecOps. Esta documentación está organizada por categorías y sirve como fuente de verdad para el desarrollo y la operación.

## Índice de Documentos

### Adr

- [ADR 0001: Reorganización del Layout del Repositorio](adr/0001-project-layout.md)
- [ADR 0002: Consolidación y Rediseño del CLI phantom](adr/0002-cli.md)
- [ADR 0003: Sistema de Plugins de la Plataforma (Borrador)](adr/0003-plugin-system.md)
- [ADR 0004: Modelo de Autenticación y Autorización (Borrador)](adr/0004-authentication.md)
- [ADR 0005: Capa de Almacenamiento y Cifrado (Borrador)](adr/0005-storage.md)
- [ADR 0006: Runtime de Next.js y Servidor Node (Borrador)](adr/0006-next-runtime.md)
- [ADR 0007: Migración a Estructura Monorepo (Borrador)](adr/0007-monorepo.md)
- [ADR 0008: Despliegue con Charts Helm en Kubernetes (Borrador)](adr/0008-helm.md)

### Api

- [Manual de API — Phantom SecOps (v0.1)](api/overview.md)

### Architecture

- [Documentación de salida — cliente](architecture/client-reports.md)
- [Diccionario de datos — Phantom SecOps](architecture/database.md)
- [Arquitectura híbrida Phantom (Go + Rust + Python)](architecture/hybrid-stack.md)
- [Vista General de la Arquitectura](architecture/overview.md)
- [Estructura del repositorio](architecture/repository.md)
- [Guía de metodología Phantom (pentester)](architecture/spectra-methodology.md)
- [Supply chain — SBOM y vulnerabilidades](architecture/supply-chain.md)
- [Documento de Arquitectura Técnica (TAD) — Phantom SecOps](architecture/tad.md)

### Cli

- [Referencia de Comandos cluster](cli/cluster.md)
- [Referencia de Comandos docker](cli/docker.md)
- [Doctor de Phantom](cli/doctor.md)
- [Referencia de Comandos locales](cli/local.md)

### Development

- [Control de Ramas y Git Flow](development/branching.md)
- [Estilo de Código y Buenas Prácticas](development/coding-style.md)
- [Guía de Contribución](development/contributing.md)
- [Depuración de la Plataforma](development/debugging.md)
- [Manual de uso de IA — validación anti-alucinaciones](development/ia-validation.md)
- [Proceso de Release y Versionado](development/release-process.md)
- [Pruebas Unitarias y de Integración](development/testing.md)

### Getting-started

- [Preguntas Frecuentes (FAQ)](getting-started/faq.md)
- [Instalación de Phantom](getting-started/installation.md)
- [Inicio Rápido con Phantom](getting-started/quick-start.md)

### Operations

- [Gestión de Respaldos (Backup)](operations/backup.md)
- [Despliegue Phantom SecOps](operations/deployment.md)
- [Operaciones con Docker](operations/docker.md)
- [Operaciones con Kubernetes](operations/kubernetes.md)
- [Monitoreo y Observabilidad](operations/monitoring.md)
- [Restauración de Snapshots (Restore)](operations/restore.md)
- [Solución de Problemas (Troubleshooting)](operations/troubleshooting.md)

### Roadmap

- [Futuras Funcionalidades](roadmap/future.md)
- [Roadmap Versión v0.5](roadmap/v0.5.md)
- [Roadmap Versión v1.0](roadmap/v1.0.md)
- [Roadmap Versión v2.0](roadmap/v2.0.md)

