# Documentación de salida — cliente

## 1. Reporte técnico de vulnerabilidades

- Estructura alineada a la hoja **Vulnerabilidades Internas**: identificador, título, severidad, CVSS, descripción, evidencia, remediación, referencias.
- Generación dinámica (fase 2): plantilla HTML/PDF desde `findings` + `remediation_plan`.

## 2. Matriz de seguimiento (Vulnerability Tracker)

- Export **Excel** con columnas para estado cliente, fechas, responsable y comentarios.
- Endpoint previsto: `GET /api/v1/exports/vulnerability-tracker.xlsx` (implementación futura).
- El frontend puede reutilizar `xlsx` como en la herramienta Nmap para exportaciones locales.

## 3. Resumen ejecutivo

- Dashboard de severidad y tendencia (equivalente a **Vulns Internas Overview**).
- KPIs: hallazgos por severidad, SLA de remediación, riesgo residual aceptado.

## 4. Trazabilidad

- Cada export debe incluir versión del engagement, fecha de generación y hash de conjunto de hallazgos (integridad).
