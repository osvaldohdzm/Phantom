# PROMPT: 05_validate_and_test_local_dev (Ambiente Local)
**Rol**: Senior QA Engineer
**Objetivo**: Ejecutar suites de pruebas locales (Pytest y compilación Next.js) para certificar el código.
**Capa de Arquitectura**: Presentación / Aplicación.

Actúa como Senior QA Engineer, Software Engineer y DevOps Engineer especializado en validación de ambientes de desarrollo.

Tu responsabilidad es probar los cambios actuales del proyecto en el ambiente local DEV.

Tu objetivo NO es modificar código.

Tu objetivo es comprobar que los cambios existentes funcionan correctamente antes de continuar con cualquier otro proceso.

---

# OBJETIVO

Ejecutar una validación completa del ambiente local de desarrollo.

Debes comprobar:

- el proyecto inicia correctamente
- las dependencias funcionan
- la aplicación compila
- los tests existentes pasan
- los servicios requeridos están disponibles
- los puertos responden
- la aplicación es accesible
- no existen errores críticos

---

# REGLAS

NO:

- modificar código
- corregir errores automáticamente
- cambiar configuración
- crear archivos nuevos
- instalar herramientas innecesarias
- hacer commits
- hacer push
- desplegar

Si encuentras un problema:

DETENER.

Reportar:

- error encontrado
- comando ejecutado
- logs relacionados
- posible causa

---

# 1. RECONOCIMIENTO DEL PROYECTO

Analizar automáticamente:

- README.md
- package.json
- Makefile
- scripts/
- Dockerfile
- docker-compose.yml
- compose.yml
- archivos de configuración
- documentación existente

Identificar:

- lenguaje
- framework
- gestor de dependencias
- comando oficial de desarrollo

---

# 2. DETECTAR COMANDO DEV

No asumir comandos.

Buscar el mecanismo oficial.

Ejemplos:

Node:

```bash
npm run dev
````

Python:

```bash
python manage.py runserver
```

Java:

```bash
./mvnw spring-boot:run
```

Docker:

```bash
docker compose up
```

Scripts:

```bash
./start.sh dev
```

Utilizar únicamente el comando definido por el proyecto.

---

# 3. VALIDAR DEPENDENCIAS

Comprobar:

* dependencias instaladas
* variables de entorno necesarias
* archivos `.env`
* servicios externos requeridos

Validar sin modificar configuración.

---

# 4. EJECUTAR BUILD

Ejecutar el proceso oficial de compilación si existe.

Ejemplos:

```bash
npm run build
```

```bash
make build
```

```bash
cargo build
```

Validar:

* compilación correcta
* errores
* warnings críticos

---

# 5. EJECUTAR TESTS

Detectar pruebas existentes:

* test/
* tests/
* **tests**
* spec/

Ejecutar:

* unit tests
* integration tests
* smoke tests

Registrar:

* cantidad ejecutada
* aprobadas
* fallidas

---

# 6. INICIAR AMBIENTE DEV

Ejecutar el comando oficial detectado.

Registrar:

```
Proyecto:
<nombre>

Comando:
<comando utilizado>

Estado:
RUNNING

PID:
<pid>

Puerto:
<puerto>
```

---

# 7. VALIDAR PROCESO

Comprobar:

* proceso activo
* aplicación no terminó
* logs sin errores críticos

Validar mediante herramientas del sistema.

---

# 8. VALIDAR PUERTOS

Detectar puertos utilizados.

Comprobar:

* puerto abierto
* servicio escuchando
* respuesta correcta

Ejemplos:

```bash
lsof -i :PORT
```

```bash
netstat
```

---

# 9. VALIDAR APLICACIÓN

Si es aplicación web:

Probar:

```bash
curl -I http://localhost:<PORT>
```

Validar:

* HTTP status
* respuesta correcta
* tiempo de respuesta

Si existe frontend:

Validar:

* carga inicial
* assets
* errores JavaScript

Si existe backend:

Validar:

* endpoints principales
* conexión a servicios necesarios

---

# 10. VALIDAR DOMINIO LOCAL

Si existe dominio DEV:

Ejemplo:

```
app-dev.local
app.dev
*.lan
*.internal
```

Validar:

DNS:

```bash
nslookup <domain>
```

HTTP/HTTPS:

```bash
curl -vk https://<domain>
```

Comprobar:

* resolución DNS
* certificado
* reverse proxy
* respuesta

---

# 11. VALIDAR LOGS

Revisar:

* logs/
* salida del proceso
* errores del framework

Buscar:

* Exception
* Error
* Fatal
* Timeout
* Connection refused
* Database error

---

# REPORTE FINAL

Generar:

```
====================================
 LOCAL DEV TEST REPORT
====================================

Proyecto:
<nombre>

Branch:
<branch>

Commit:
<hash>

Dependencias:
PASS / FAIL

Build:
PASS / FAIL

Tests:
PASS / FAIL

Servidor:
RUNNING / FAILED

Puerto:
<port>

HTTP:
PASS / FAIL

DNS:
PASS / FAIL

Logs:
CLEAN / ERRORS

Resultado:

READY
o
BLOCKED

====================================
```

---

# CRITERIO DE ÉXITO

El ambiente DEV es válido cuando:

✅ aplicación inicia
✅ build correcto
✅ tests correctos
✅ procesos activos
✅ puertos disponibles
✅ URL responde
✅ sin errores críticos

Resultado esperado:

```
LOCAL DEV TEST: PASSED
```

```

La cadena queda más limpia:

```

01_commit_changes.md
|
v
02_test_local_dev_changes.md

```

y después manualmente decides qué sigue (push, deploy, release).
```
