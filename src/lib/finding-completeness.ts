import type { Finding } from '@/lib/secops-api';
import {
  getActiveReviewFields,
  getCatalogFieldConfigSync,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import type { ReviewFieldKey } from '@/lib/review-fields';

export type { ReviewFieldKey } from '@/lib/review-fields';
export { REVIEW_FIELDS } from '@/lib/review-fields';

export type CompletenessResult = {
  filled: number;
  total: number;
  missing: string[];
  missingKeys: ReviewFieldKey[];
  percent: number;
  geminiReady: boolean;
};

export function findingCompleteness(
  f: Finding,
  config?: CatalogFieldConfig
): CompletenessResult {
  const activeFields = getActiveReviewFields(config ?? getCatalogFieldConfigSync());
  const missing: string[] = [];
  const missingKeys: ReviewFieldKey[] = [];

  for (const { key, label, minLen } of activeFields) {
    const val = String(f[key] ?? '').trim();
    if (val.length < minLen) {
      missing.push(label);
      missingKeys.push(key);
    }
  }

  const total = activeFields.length;
  const filled = total - missing.length;
  const raw = String(f.raw_tool_output ?? '').trim();
  const geminiReady = raw.length >= 20 && missingKeys.some((k) => k !== 'raw_tool_output');

  return {
    filled,
    total,
    missing,
    missingKeys,
    percent: total > 0 ? Math.round((filled / total) * 100) : 100,
    geminiReady,
  };
}

export type ReviewFilter =
  | 'all'
  | 'incomplete'
  | 'gemini-ready'
  | 'complete'
  | 'missing-descripcion'
  | 'missing-amenaza';

export function matchesReviewFilter(f: Finding, filter: ReviewFilter): boolean {
  const c = findingCompleteness(f);
  switch (filter) {
    case 'all':
      return true;
    case 'incomplete':
      return c.missing.length > 0;
    case 'complete':
      return c.missing.length === 0;
    case 'gemini-ready':
      return c.geminiReady;
    case 'missing-descripcion':
      return c.missingKeys.includes('descripcion');
    case 'missing-amenaza':
      return c.missingKeys.includes('amenaza_ampliada');
    default:
      return true;
  }
}
