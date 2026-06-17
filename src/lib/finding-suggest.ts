import type { SuggestedFinding } from '@/lib/secops-api';
import type { FindingFormValues } from '@/components/finding-form-editor';
import { EMPTY_FINDING_FORM } from '@/components/finding-form-editor';
import { capitalizeLineStarts, toPlainReportText } from '@/lib/plain-report-text';
import { mergeSuggestionWithStructured, parseStructuredFinding } from '@/lib/parse-structured-finding';

export function suggestionToFormValues(
  suggestion: SuggestedFinding,
  rawOutput: string,
  base: FindingFormValues = EMPTY_FINDING_FORM
): FindingFormValues {
  const { suggestion: merged, raw_tool_output: structuredSalidas } = mergeSuggestionWithStructured(
    suggestion,
    rawOutput
  );
  const parsed = parseStructuredFinding(rawOutput);
  const isStructured = (parsed?.confidence ?? 0) >= 0.35;

  const componentes = merged.componente_afectado
    ? suggestion.componente_afectado
        .split(/\n/)
        .flatMap((line) => line.split(/●|•/))
        .map((s) => toPlainReportText(s.replace(/^[\s\-*]+/, '').trim()))
        .filter(Boolean)
    : base.componentes_afectados.filter(Boolean);

  const plain = (value: string) => capitalizeLineStarts(toPlainReportText(value));

  const rawTool =
    structuredSalidas?.trim() ||
    (isStructured ? '' : toPlainReportText(rawOutput) || rawOutput);

  return {
    ...base,
    titulo: plain(merged.titulo),
    severidad: merged.severidad,
    descripcion: plain(merged.descripcion),
    amenaza_ampliada: plain(merged.amenaza_ampliada),
    propuesta_remediacion: plain(merged.propuesta_remediacion),
    referencias: plain(merged.referencias),
    metodo_deteccion: plain(merged.metodo_deteccion),
    explicacion_tecnica: capitalizeLineStarts(merged.explicacion_tecnica || ''),
    raw_tool_output: rawTool,
    cve: merged.cve || '',
    cwe: merged.cwe || '',
    cvss_score: merged.cvss_score != null ? String(merged.cvss_score) : '',
    componentes_afectados: componentes.length ? componentes : [''],
  };
}
