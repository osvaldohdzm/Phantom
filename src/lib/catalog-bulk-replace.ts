import { VULNS_CATALOG_EDITABLE_COLUMNS } from '@/lib/vulns-catalog-columns';

export type BulkReplaceMode = 'exact' | 'regex';

export type BulkReplaceRule = {
  find: string;
  replace: string;
  mode: BulkReplaceMode;
  /** Solo aplica en modo exact; por defecto true */
  case_insensitive?: boolean;
  /** null o vacío = todas las columnas de texto editables */
  columns?: string[] | null;
};

export type BulkReplaceScope = {
  query?: string;
  severity?: string;
  filterColumn?: string;
  filterValue?: string;
};

export type BulkReplaceSample = {
  id: string;
  column: string;
  before: string;
  after: string;
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isSafeColumnName(column: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(column);
}

export const BULK_REPLACE_DEFAULT_COLUMNS = VULNS_CATALOG_EDITABLE_COLUMNS.filter((c) =>
  c.startsWith('Esp')
);

export function resolveTargetColumns(
  requested: string[] | null | undefined,
  allowed: string[]
): string[] {
  const allowedSet = new Set(allowed);
  if (!requested?.length) {
    return allowed.filter((c) => VULNS_CATALOG_EDITABLE_COLUMNS.includes(c as never));
  }
  return requested.filter((c) => allowedSet.has(c));
}

export function validateRegexPattern(pattern: string, flags = 'gi'): string | null {
  if (!pattern.trim()) return 'El patrón no puede estar vacío';
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern, flags.replace(/g/g, ''));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Expresión regular inválida';
  }
}

export function applyReplaceToText(text: string, rule: BulkReplaceRule): string {
  if (!text || !rule.find) return text;
  if (rule.mode === 'exact') {
    const insensitive = rule.case_insensitive !== false;
    if (insensitive) {
      return text.replace(new RegExp(escapeRegExp(rule.find), 'gi'), rule.replace);
    }
    return text.split(rule.find).join(rule.replace);
  }
  const flags = 'gi';
  return text.replace(new RegExp(rule.find, flags), rule.replace);
}

export function textWouldChange(text: string, rule: BulkReplaceRule): boolean {
  if (!text || !rule.find) return false;
  return applyReplaceToText(text, rule) !== text;
}

export function buildScopeWhere(
  scope: BulkReplaceScope | undefined,
  allowedColumns: Set<string>
): { whereSql: string; values: unknown[] } {
  const whereClauses: string[] = [];
  const values: unknown[] = [];

  const query = scope?.query?.trim();
  if (query) {
    values.push(`%${query}%`);
    const index = values.length;
    whereClauses.push(
      `("StandardVulnerabilityName" ILIKE $${index} OR "Vulnerability" ILIKE $${index} OR "Description" ILIKE $${index} OR "CVE" ILIKE $${index} OR "CWE" ILIKE $${index} OR "EspNombreVulnerabilidadUnificado" ILIKE $${index})`
    );
  }

  if (scope?.severity?.trim()) {
    values.push(scope.severity.trim());
    whereClauses.push(`"Severity" = $${values.length}`);
  }

  const filterColumn = scope?.filterColumn?.trim();
  const filterValue = scope?.filterValue?.trim();
  if (filterColumn && filterValue && allowedColumns.has(filterColumn)) {
    values.push(filterValue);
    whereClauses.push(`"${filterColumn}" = $${values.length}`);
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    values,
  };
}
