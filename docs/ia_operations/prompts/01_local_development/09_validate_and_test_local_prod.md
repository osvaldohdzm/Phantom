Actúa como un Ingeniero DevOps / SRE. Tu objetivo es realizar un **Sanity Check (Validación de Salud)** del entorno de **Producción (`prod`)** para garantizar que los cambios recién propagados o la reestructuración de servicios se ejecutaron correctamente y están funcionando sin errores.

---

## 🔍 Checklist de Validación Paso a Paso

### 1. Verificación de Process & Daemon Status
- Revisa que los procesos de producción estén activos y corriendo en sus puertos correspondientes:
  - Verificar PIDs / PM2 / Systemd / Docker para los proyectos objetivo (ej. `amatista`, `phantom`, `ambar`, `moon`).
  - Confirmar que los puertos de producción asignados (según `~/.orbital-ports.yaml`) estén escuchando (`netstat -tuln` o `lsof -i`).

### 2. Validación de Conectividad HTTP y Subdominios
- Ejecuta peticiones de prueba (`curl -Iv` o similar) a las URLs de Producción:
  - Base: `http://<PROJECT_NAME>.orbitalapps.lan` (ej. `http://amatista.orbitalapps.lan`).
  - **Requisito estricto:** Confirmar que retorne un código de respuesta **HTTP 200 OK** (o redirección válida HTTP 301/302).
  - Confirmar que la URL de producción **NO** redirija ni contenga el sufijo `-dev`.

### 3. Validación de Archivos de Entorno (`.env`)
- Inspecciona la configuración activa en `apps/prod/<PROJECT_NAME>-prod/.env`:
  - `NODE_ENV` = `production`
  - `PORT` = `<PORT_PROD>`
  - `APP_URL` = `http://<PROJECT_NAME>.orbitalapps.lan`

### 4. Verificación de Base de Datos y Logs de Error
- Revisa los últimos logs de la aplicación de producción en busca de excepciones o errores en tiempo de ejecución:
  - Revisar archivos en `logs/`, la salida de PM2/Docker o `journalctl`.
  - Confirmar que la conexión a la base de datos de producción esté activa y sin errores de credenciales o de schema.

---

## 📊 Reporte de Estado Final

Presenta los resultados en una tabla clara:

| Proyecto | Subdominio Prod | Puerto Prod | Estado Proceso | Respuesta HTTP | Estado .env | Diagnóstico Final |
|---|---|---|---|---|---|---|
| amatista | amatista.orbitalapps.lan | 4000 | ACTIVO | 200 OK | Correcto |  OPERATIVO |
| phantom | phantom.orbitalapps.lan | 4001 | ACTIVO | 500 Error | Incorrecto |  REQUIERE REVISIÓN |

---

## 🛡️ Reglas de Seguridad
- **Solo Lectura (Read-Only):** Esta etapa es exclusivamente de inspección y prueba. No modifiques código, no hagas restarts ni alteres bases de datos a menos que el usuario lo autorice tras ver el reporte.