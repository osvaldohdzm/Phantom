# ROL: DevOps & Site Reliability Engineer (Humano)

## 📌 Descripción General
El **DevOps & Site Reliability Engineer (SRE)** se encarga de diseñar, mantener y asegurar la estabilidad de la infraestructura física, virtualizada y de contenedores del proyecto Phantom. Su prioridad es la automatización de la entrega continua, la seguridad de las redes de desarrollo e híbridas (Tailscale, Caddy) y la resiliencia del stack.

---

## 🛠️ Responsabilidades
1. **Administración de Entornos**: Configurar y monitorizar los entornos nativos locales y de producción en macOS y Linux (Ubuntu).
2. **Orquestación de Contenedores**: Mantener los manifiestos de Docker Compose (`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`) e implementar la migración hacia Kubernetes (`deploy/kubernetes`).
3. **Gestión de Proxy Inverso y TLS**: Mantener el servidor Caddy local para enrutamiento interno (`*.orbitalapps.lan`) y la rotación automatizada de certificados TLS locales (`mkcert`).
4. **Respaldos y Recuperación**: Diseñar e instrumentar scripts operativos de respaldo (`backup`, `restore`, `migrate`) para base de datos y almacenamiento persistente.
5. **Hardening de Sistemas**: Aplicar políticas de cortafuegos (UFW) y asegurar que las conexiones locales y de contenedores utilicen contraseñas robustas y variables cifradas.

---

## 🎓 Requisitos y Skillset
* **Experiencia**: +5 años en administración de sistemas Linux/Unix y automatización de despliegues.
* **Herramientas Clave**: Docker, Podman, Kubernetes (kubectl, Kustomize), Caddy Server, Nginx, Shell Scripting (Bash avanzado), Tailscale.
* **Seguridad de Redes**: Conceptos de DNS local, certificados SSL autocomfirmados, HTTPS nativo y proxy de reenvío inverso.
* **Bases de Datos**: Mantenimiento preventivo, replicación y optimización de PostgreSQL y Redis.

---

## 🤝 Protocolo de Colaboración con Agentes IA
* **Automatización de Manifiestos**: El DevOps humano encarga a agentes de infraestructura la generación de configuraciones repetitivas de Kubernetes o Dockerfiles, validando y auditando que no existan puertos expuestos de manera insegura.
* **Aprovisionamiento**: Delega a los agentes la verificación de sockets y el diagnóstico inicial (`./phantom doctor`), utilizando las salidas estructuradas para corregir fallos del host.
