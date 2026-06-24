import type { TenantLanguage } from '@/lib/tenant-locale';

/** Preferencia personal de idioma de interfaz. `auto` sigue el tenant activo. */
export type UiLanguagePreference = 'auto' | TenantLanguage;

export function resolveUiLanguage(
  preference: UiLanguagePreference | null | undefined,
  tenantLanguage: TenantLanguage
): TenantLanguage {
  if (preference === 'es' || preference === 'en') return preference;
  return tenantLanguage;
}

export const UI_LANGUAGE_OPTIONS: { id: UiLanguagePreference; labelKey: string }[] = [
  { id: 'auto', labelKey: 'profileLangAuto' },
  { id: 'es', labelKey: 'languageSpanish' },
  { id: 'en', labelKey: 'languageEnglish' },
];
