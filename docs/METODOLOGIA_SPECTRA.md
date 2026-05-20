# Guía de metodología Spectra (pentester)

## 1. Alcance y compromiso

1. Revisar **SoW** y **reglas de compromiso** en el engagement (tipo de caja, IPs/FQDN excluidos/incluidos).
2. Registrar alcance en la plataforma (activos y superficie) antes de cualquier prueba invasiva.

## 2. Reconocimiento

1. OSINT permitido contractualmente (whois, DNS, metadata pública).
2. Importar salidas de **Nmap** u otras herramientas a la hoja **Superficie de Ataque** / módulo de inventario.
3. No exceder frecuencia ni vectores prohibidos en el contrato.

## 3. Ejecución técnica

1. Seleccionar marco: **WSTG** (web), **MASTG** (móvil), **OSSTMM** (cuando aplique por tipo de evaluación).
2. Documentar cada caso de prueba: objetivo, pasos, resultado, riesgo.
3. Mantener trazabilidad entre **hallazgo** y **evidencia** (capturas, requests, logs).

## 4. Explotación y post-explotación

1. Registrar **PoC** mínima necesaria para demostrar impacto.
2. Evidencia multimedia: almacenar referencias (`evidencia_url`), no datos sensibles sin cifrar en tickets informales.
3. Limitar persistencia y movimiento lateral a lo acordado.

## 5. Reporteo

1. **Técnico:** descripción, impacto, remediación verificable, referencias CVE/CWE/CVSS.
2. **Ejecutivo:** riesgo de negocio, priorización, dependencias.
3. Exportar **Matriz de seguimiento** para el cliente y cerrar ciclo en VUL-Mgmt.

## 6. Calidad y ética

- Principio de mínimo impacto en producción.
- Coordinación con SOC si aplica (playbooks de detección).
