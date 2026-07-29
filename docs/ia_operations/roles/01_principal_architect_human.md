# ROL: Principal Software Architect & Tech Lead (Humano)

## 📌 Descripción General
El **Principal Software Architect & Tech Lead** es el líder técnico y estratega del proyecto Phantom. Es responsable de definir la visión técnica, tomar decisiones arquitectónicas de alto nivel (como la migración a arquitecturas Bare/Worktree y el proxy inverso con Caddy), garantizar la seguridad de la plataforma y guiar a los ingenieros de software y a los agentes de IA en la implementación de características complejas.

---

## 🛠️ Responsabilidades
1. **Diseño de Arquitectura**: Definir y mantener los patrones de diseño del sistema, estructura de microservicios (Next.js, FastAPI, Go/Rust ingesters) y el esquema de base de datos.
2. **Gobierno de Git**: Establecer políticas para el historial Git, convenciones de *Conventional Commits*, flujos de trabajo en ramas y la estrategia de despliegue multientorno (local, docker, cluster).
3. **Revisión de Código Crítico**: Revisar y aprobar los Pull Requests de cambios estructurales, APIs críticas y configuraciones de seguridad.
4. **Coordinación Humano-IA**: Definir el contexto del repositorio (`AGENTS.md`, `CLAUDE.md`, prompt templates) para guiar eficientemente a los agentes autónomos de codificación.
5. **Mitigación de Deuda Técnica**: Identificar cuellos de botella de rendimiento y liderar refactorizaciones mayores.

---

## 🎓 Requisitos y Skillset
* **Experiencia**: +8 años de experiencia en desarrollo web full-stack y arquitectura de software.
* **Lenguajes y Tecnologías**: Profundo conocimiento en TypeScript/Node.js (Next.js App Router), Python (FastAPI, SQLAlchemy), PostgreSQL y orquestación con Docker Compose / Kubernetes.
* **Seguridad**: Modelado de amenazas, gestión de secretos en producción y hardening de bases de datos.
* **Git Avanzado**: Gestión de subárboles, submódulos, worktrees y resolución avanzada de conflictos.

---

## 🤝 Protocolo de Colaboración con Agentes IA
* **Instrucciones**: Diseña especificaciones técnicas claras y prompts contextuales estructurados antes de delegar tareas repetitivas o de refactorización aislada a los agentes IA.
* **Auditoría**: Valida los entregables de los agentes IA en entornos locales antes de promover cambios a producción.
* **Mantenimiento**: Actualiza el archivo `AGENTS.md` a medida que la arquitectura evolucione para que los agentes mantengan consistencia de contexto.
