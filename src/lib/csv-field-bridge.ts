/**
 * Puente Seguimiento CSV ↔ campos oficiales ↔ matriz CYB001 ↔ inventario.
 */

export type CsvFieldBridgeRow = {
  officialField: string;
  seguimientoColumn?: string;
  matrixColumn: string;
  inventoryColumn?: string;
  notes?: string;
};

/** Mapeo recomendado para importación Seguimiento + enriquecimiento desde inventario. */
export const SEGUIMIENTO_FIELD_BRIDGE: CsvFieldBridgeRow[] = [
  {
    officialField: 'Hosts afectados',
    seguimientoColumn: 'Hosts afectados',
    matrixColumn: 'IPv4 Interna / Hostname',
    inventoryColumn: 'IPv4 Privado / Nombre de Host Privado',
    notes: 'Match por IP para enlazar activo e inventario',
  },
  {
    officialField: 'Grupo de activos',
    seguimientoColumn: 'Grupo de Activos',
    matrixColumn: 'Grupo de activos',
    inventoryColumn: 'Grupos de Activos',
    notes: 'Varios valores como tags (; , |). Se fusionan CSV + inventario',
  },
  {
    officialField: 'Subgrupo de activos',
    seguimientoColumn: 'Sub grupo de Activos (si existe)',
    matrixColumn: 'Subgrupo de activos',
    inventoryColumn: 'Subgrupos de Activos',
    notes: 'Varios valores como tags',
  },
  {
    officialField: 'Tipo de activo',
    seguimientoColumn: 'Tipo de Activo',
    matrixColumn: 'Tipo de Activo',
    inventoryColumn: 'Tipo de Máquina / Dominio Tecnológico',
  },
  {
    officialField: 'Componentes afectados',
    seguimientoColumn: 'Componentes afectados',
    matrixColumn: 'Componente afectado',
    notes: 'Solo IP:puerto o URL; no mezclar con hosts ni grupo',
  },
  {
    officialField: 'Recomendación',
    seguimientoColumn: 'Recomendación',
    matrixColumn: 'Propuesta de remediación ampliada',
  },
  {
    officialField: 'Tiempo de remediación',
    seguimientoColumn: 'Tiempo de remediación',
    matrixColumn: 'Tipo de remediación sugerida',
    notes: 'También se guarda en remediation_context',
  },
  {
    officialField: 'Tipo de mitigación',
    seguimientoColumn: 'Tipo de mitigación',
    matrixColumn: 'Tipo de remediación sugerida',
  },
  {
    officialField: 'Fecha de detección',
    seguimientoColumn: 'Fecha de detección',
    matrixColumn: 'Fecha de detección',
  },
  {
    officialField: 'Estatus',
    seguimientoColumn: 'Estatus',
    matrixColumn: 'Estado',
  },
  {
    officialField: 'Proyecto',
    seguimientoColumn: 'Proyecto',
    matrixColumn: 'Conjunto de nombres',
  },
  {
    officialField: 'Título',
    seguimientoColumn: 'Vulnerabilidad',
    matrixColumn: 'Nombre de vulnerabilidad / Nombre de hallazgo',
  },
  {
    officialField: 'Descripción',
    seguimientoColumn: 'Descripción',
    matrixColumn: 'Descripción del hallazgo',
    notes: 'CVE/CWE/CVSS se extraen aquí si no hay columnas dedicadas',
  },
  {
    officialField: 'Severidad',
    seguimientoColumn: 'Severidad',
    matrixColumn: 'Severidad',
  },
  {
    officialField: 'Método',
    seguimientoColumn: 'Herramienta de detección',
    matrixColumn: 'Método de detección / Tipo de origen',
  },
];
