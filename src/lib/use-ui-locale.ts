'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { coerceTenantLanguage } from '@/lib/tenant-locale';
import {
  reviewFilterOptions,
  roleLabel,
  uiFormat,
  uiT,
  vulnMatrixViewOptions,
  type UiMessageKey,
} from '@/lib/ui-locale';

export function useUiT() {
  const { uiLanguage, tenantLanguage } = useAuth();
  const lang = coerceTenantLanguage(uiLanguage);
  const t = useCallback((key: UiMessageKey) => uiT(key, lang), [lang]);
  const format = useCallback(
    (key: UiMessageKey, vars: Record<string, string | number>) =>
      uiFormat(uiT(key, lang), vars),
    [lang]
  );
  const role = useCallback(
    (r: Parameters<typeof roleLabel>[0]) => roleLabel(r, lang),
    [lang]
  );
  const matrixViews = useCallback(() => vulnMatrixViewOptions(lang), [lang]);
  const reviewFilters = useCallback(() => reviewFilterOptions(lang), [lang]);
  return { t, format, uiLanguage: lang, tenantLanguage, role, matrixViews, reviewFilters };
}
