export type ReviewFieldKey =
  | 'descripcion'
  | 'amenaza_ampliada'
  | 'propuesta_remediacion'
  | 'referencias'
  | 'componente_afectado'
  | 'metodo_deteccion'
  | 'explicacion_tecnica'
  | 'raw_tool_output';

export const REVIEW_FIELDS: { key: ReviewFieldKey; label: string; minLen: number }[] = [
  { key: 'descripcion', label: 'Descripción', minLen: 30 },
  { key: 'amenaza_ampliada', label: 'Amenaza', minLen: 30 },
  { key: 'propuesta_remediacion', label: 'Remediación', minLen: 15 },
  { key: 'referencias', label: 'Referencias', minLen: 3 },
  { key: 'componente_afectado', label: 'Componente', minLen: 3 },
  { key: 'metodo_deteccion', label: 'Método det.', minLen: 5 },
  { key: 'explicacion_tecnica', label: 'Expl. técnica', minLen: 10 },
  { key: 'raw_tool_output', label: 'Salidas herr.', minLen: 20 },
];
