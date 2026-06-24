import type { TenantBranding } from '@/lib/tenant-branding';

/** Idioma operativo del tenant para catálogo, hallazgos e informes. */
export type TenantLanguage = 'es' | 'en';

export const TENANT_LANGUAGE_OPTIONS: { id: TenantLanguage; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

export const DEFAULT_TENANT_LANGUAGE: TenantLanguage = 'es';

export function resolveTenantLanguage(
  branding?: TenantBranding | null
): TenantLanguage {
  const raw = branding?.language?.trim().toLowerCase();
  return raw === 'en' ? 'en' : 'es';
}

/** Garantiza es|en; evita fallos si la API devuelve auto/undefined. */
export function coerceTenantLanguage(
  value: unknown,
  fallback: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): TenantLanguage {
  return value === 'en' ? 'en' : value === 'es' ? 'es' : fallback;
}

/** Campos lógicos del catálogo (independientes del idioma). */
export type CatalogLocaleFieldKey =
  | 'title'
  | 'severity'
  | 'description'
  | 'threat_general'
  | 'threat_internet'
  | 'remediation'
  | 'remediation_private'
  | 'detection_method'
  | 'technical_explanation';

/** Columna física en core.vulns_catalog por idioma. */
export type CatalogLocaleColumn = string;

const LOCALE_COLUMNS: Record<TenantLanguage, Record<CatalogLocaleFieldKey, CatalogLocaleColumn>> = {
  es: {
    title: 'EspNombreVulnerabilidadUnificado',
    severity: 'EspSeveridadUnificada',
    description: 'EspDescripcionUnificada',
    threat_general: 'EspAmenazaUnificadaGeneral',
    threat_internet: 'EspAmenazaUnificadaDesdeInternet',
    remediation: 'EspPropuestaRemediacionUnificada',
    remediation_private: 'EspPropuestaRemediacionUnificadaEnRedPrivada',
    detection_method: 'EspMetodoDeteccion',
    technical_explanation: 'EspExplicacionTecnica',
  },
  en: {
    title: 'StandardVulnerabilityName',
    severity: 'Severity',
    description: 'Description',
    threat_general: 'Danger',
    threat_internet: 'Danger',
    remediation: 'Solution',
    remediation_private: 'Solution',
    detection_method: 'SourceDetection',
    technical_explanation: 'Description',
  },
};

/** Campos con IA / revisión obligatoria (columnas físicas). */
export const LOCALE_AI_FIELD_KEYS: CatalogLocaleFieldKey[] = [
  'severity',
  'description',
  'threat_general',
  'threat_internet',
  'remediation',
  'remediation_private',
  'detection_method',
  'technical_explanation',
];

export const LOCALE_CONTEXT_FIELD_KEYS: CatalogLocaleFieldKey[] = [
  'title',
  ...LOCALE_AI_FIELD_KEYS,
];

export function catalogColumnForLocale(
  key: CatalogLocaleFieldKey,
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): CatalogLocaleColumn {
  return LOCALE_COLUMNS[language][key];
}

/** Mantiene orden; en EN varias claves lógicas comparten columna (Description, Danger, Solution). */
export function uniqueCatalogColumns(columns: CatalogLocaleColumn[]): CatalogLocaleColumn[] {
  const seen = new Set<string>();
  const out: CatalogLocaleColumn[] = [];
  for (const col of columns) {
    if (seen.has(col)) continue;
    seen.add(col);
    out.push(col);
  }
  return out;
}

const SPANISH_LOCALE_COLUMNS = new Set(Object.values(LOCALE_COLUMNS.es));

/** Oculta columnas Esp* en el editor cuando el tenant opera en inglés. */
export function shouldHideCatalogColumnInEditor(
  column: string,
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): boolean {
  return language === 'en' && SPANISH_LOCALE_COLUMNS.has(column);
}

export function catalogLocaleAiColumns(
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): CatalogLocaleColumn[] {
  return uniqueCatalogColumns(
    LOCALE_AI_FIELD_KEYS.map((k) => catalogColumnForLocale(k, language))
  );
}

export function catalogLocaleContextColumns(
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): CatalogLocaleColumn[] {
  return uniqueCatalogColumns(
    LOCALE_CONTEXT_FIELD_KEYS.map((k) => catalogColumnForLocale(k, language))
  );
}

export function catalogLocaleMandatoryColumns(
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): CatalogLocaleColumn[] {
  return uniqueCatalogColumns(
    (
      [
        'title',
        'severity',
        'description',
        'threat_general',
        'remediation',
        'detection_method',
        'technical_explanation',
      ] as CatalogLocaleFieldKey[]
    ).map((k) => catalogColumnForLocale(k, language))
  );
}

const LOCALE_COLUMN_LABELS: Record<TenantLanguage, Record<CatalogLocaleFieldKey, string>> = {
  es: {
    title: 'Nombre unificado',
    severity: 'Severidad',
    description: 'Descripción',
    threat_general: 'Amenaza',
    threat_internet: 'Amenaza (Internet)',
    remediation: 'Remediación',
    remediation_private: 'Remediación (red privada)',
    detection_method: 'Método de detección',
    technical_explanation: 'Explicación técnica',
  },
  en: {
    title: 'Vulnerability name',
    severity: 'Severity',
    description: 'Description',
    threat_general: 'Threat / impact',
    threat_internet: 'Threat (Internet-facing)',
    remediation: 'Remediation',
    remediation_private: 'Remediation (private network)',
    detection_method: 'Detection method',
    technical_explanation: 'Technical explanation',
  },
};

/** Etiqueta legible para una columna del catálogo según idioma del tenant. */
export function catalogLocaleColumnLabel(
  column: string,
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): string | null {
  for (const key of LOCALE_CONTEXT_FIELD_KEYS) {
    if (catalogColumnForLocale(key, language) === column) {
      return LOCALE_COLUMN_LABELS[language][key];
    }
  }
  return null;
}

/** Columnas fuente en inglés/técnico que alimentan la redacción localizada. */
export const LOCALE_SOURCE_COLUMNS = [
  'StandardVulnerabilityName',
  'Vulnerability',
  'Severity',
  'SourceDetection',
  'Description',
  'Danger',
  'Solution',
  'CVE',
  'CWE',
  'CVSSOverallScore3_1',
  'References',
  'NessusPluginId',
] as const;

export const LOCALE_FIELD_SOURCE_HINTS: Record<
  TenantLanguage,
  Partial<Record<CatalogLocaleFieldKey, string>>
> = {
  es: {
    severity: 'Prioriza Severity y el impacto descrito en Description/Danger.',
    description: 'Prioriza Description y el contexto de Vulnerability/CVE.',
    threat_general: 'Prioriza Danger, Description y CVE; describe impacto y escenarios.',
    threat_internet: 'Prioriza Danger/Description asumiendo exposición a Internet.',
    remediation: 'Prioriza Solution y cualquier workaround indicado.',
    remediation_private: 'Prioriza Solution adaptado a red privada/interna.',
    detection_method: 'Prioriza SourceDetection, NessusPluginId y Description (cómo se detectó).',
    technical_explanation: 'Prioriza Description, CVE, CWE y detalles técnicos del registro.',
  },
  en: {
    severity: 'Use exactly one of: Critical, High, Medium, Low, Informational (from scanner severity).',
    description: 'Clear vulnerability description for executive and technical audiences.',
    threat_general: 'Threat/impact: initial paragraph and actor scenarios with " - " prefix lines if needed.',
    threat_internet: 'Threat assuming Internet exposure; narrative paragraph with scenario lines.',
    remediation: 'General remediation: intro paragraph and steps with " - " prefix lines.',
    remediation_private: 'Remediation for private/internal network context.',
    detection_method: 'Brief detection method (Nessus scan, manual test, etc.).',
    technical_explanation: 'Technical root cause, protocol or configuration involved.',
  },
};

export const LOCALE_DEFAULT_AI_HINTS: Record<
  TenantLanguage,
  Partial<Record<CatalogLocaleFieldKey, string>>
> = {
  es: {
    severity: 'Usa exactamente uno de: Crítica, Alta, Media, Baja, Informativa (según la severidad en inglés).',
    description:
      'Descripción clara de la vulnerabilidad en español, orientada a informe ejecutivo y técnico. Si enumeras CVE o fallos concretos, un CVE o fallo por línea con prefijo " - ".',
    threat_general:
      'Amenaza/impacto en español: párrafo inicial y, si aplica, escenarios por actor en líneas con prefijo " - ".',
    threat_internet:
      'Amenaza si el activo es expuesto a Internet; párrafo narrativo y escenarios en líneas " - " si hay varios puntos.',
    remediation:
      'Remediación general en español: párrafo introductorio y cada paso en una línea con prefijo " - ".',
    remediation_private:
      'Remediación en red privada en español: párrafo y acciones en líneas " - " (una acción por línea).',
    detection_method: 'Breve descripción del método de detección (escáner Nessus, prueba manual, etc.).',
    technical_explanation:
      'Explicación técnica en español: causa raíz, protocolo o configuración involucrada. Detalles técnicos o CVE en líneas separadas con prefijo " - ".',
  },
  en: {
    severity: 'Use exactly one of: Critical, High, Medium, Low, Informational.',
    description:
      'Clear vulnerability description for security reports. List CVEs or issues one per line with " - " prefix.',
    threat_general:
      'Threat/impact: opening paragraph and actor scenarios on separate " - " lines if applicable.',
    threat_internet: 'Threat assuming Internet exposure; narrative with scenario lines.',
    remediation: 'General remediation: intro paragraph and each step on a " - " line.',
    remediation_private: 'Remediation for private network context with " - " action lines.',
    detection_method: 'Brief detection method (Nessus scan, manual test, etc.).',
    technical_explanation:
      'Technical explanation: root cause, protocol or configuration. Technical details on " - " lines.',
  },
};

export const LOCALE_DEFAULT_MIN_LENGTHS: Record<
  TenantLanguage,
  Partial<Record<CatalogLocaleFieldKey, number>>
> = {
  es: {
    title: 5,
    severity: 3,
    description: 30,
    threat_general: 30,
    threat_internet: 20,
    remediation: 15,
    remediation_private: 15,
    detection_method: 5,
    technical_explanation: 10,
  },
  en: {
    title: 5,
    severity: 3,
    description: 30,
    threat_general: 30,
    threat_internet: 20,
    remediation: 15,
    remediation_private: 15,
    detection_method: 5,
    technical_explanation: 10,
  },
};

/** Mapeo columna catálogo → campo hallazgo según idioma. */
export function catalogColumnToFindingField(
  column: string,
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): string | null {
  const map: Partial<Record<CatalogLocaleFieldKey, string>> = {
    description: 'descripcion',
    threat_general: 'amenaza_ampliada',
    threat_internet: 'amenaza_ampliada',
    remediation: 'propuesta_remediacion',
    remediation_private: 'propuesta_remediacion',
    detection_method: 'metodo_deteccion',
    technical_explanation: 'explicacion_tecnica',
  };
  for (const [key, findingField] of Object.entries(map) as [CatalogLocaleFieldKey, string][]) {
    if (catalogColumnForLocale(key, language) === column) return findingField;
  }
  if (language === 'es') {
    if (column === 'Description') return 'descripcion';
    if (column === 'Danger') return 'amenaza_ampliada';
    if (column === 'Solution') return 'propuesta_remediacion';
  }
  return null;
}

/** Mapeo columna spreadsheet → columna catálogo según idioma. */
export function spreadsheetColumnToCatalogColumn(
  columnId: string,
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): CatalogLocaleColumn | null {
  const map: Partial<Record<string, CatalogLocaleFieldKey>> = {
    severidad: 'severity',
    descripcion: 'description',
    amenaza_ampliada: 'threat_general',
    propuesta_remediacion: 'remediation',
    metodo_deteccion: 'detection_method',
    explicacion_tecnica: 'technical_explanation',
  };
  const key = map[columnId];
  return key ? catalogColumnForLocale(key, language) : null;
}

/** Compatibilidad: alias Esp* → clave lógica (solo español). */
export function localeFieldKeyFromColumn(
  column: string,
  language: TenantLanguage = DEFAULT_TENANT_LANGUAGE
): CatalogLocaleFieldKey | null {
  for (const key of LOCALE_CONTEXT_FIELD_KEYS) {
    if (catalogColumnForLocale(key, language) === column) return key;
  }
  return null;
}

/** Prompt de idioma para IA. */
export function aiLanguageLabel(language: TenantLanguage): string {
  return language === 'en' ? 'English' : 'Español';
}
