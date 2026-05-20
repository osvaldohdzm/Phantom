# Manual de uso de IA — validación anti-alucinaciones

## 1. Principio

La IA **acelera redacción y mapeos**; **no sustituye** el juicio del analista ni la verificación en el activo real.

## 2. Flujo recomendado

1. Pegar **solo** salida de herramienta y metadatos verificados (versión, puerto, evidencia).
2. Ejecutar enriquecimiento (`/findings/{id}/ai-enrich`).
3. **Checklist de validación** antes de publicar al cliente:

   - [ ] ¿Cada CVE/CWE citado aparece en la evidencia o en advisory oficial?
   - [ ] ¿La versión del componente coincide con inventario?
   - [ ] ¿El vector CVSS propuesto es coherente con métricas reales?
   - [ ] ¿OWASP/MITRE sugeridos tienen cita textual en la descripción?
   - [ ] ¿La remediación es aplicable al SO/runtime del cliente?

## 3. Señales de alucinación

- Comandos de parche para paquetes inexistentes en la distro declarada.
- CVE genéricos “de relleno” sin relación con el servicio.
- Explicaciones que contradicen la captura adjunta.

## 4. Política de informe

- Marcar párrafos generados por IA con convención interna (etiqueta/fuente) en la versión final exportada.
- Conservar **raw_tool_output** inmutable para auditoría.

## 5. Modo sin LLM

Si no hay `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, el backend usa **texto plantilla** que no inventa versiones: el analista debe completar impacto y remediación.
