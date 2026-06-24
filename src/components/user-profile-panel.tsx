'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Globe, Loader2, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { updateUserPreferences } from '@/lib/auth-api';
import { TENANT_LANGUAGE_OPTIONS } from '@/lib/tenant-locale';
import { UI_LANGUAGE_OPTIONS, type UiLanguagePreference } from '@/lib/user-preferences';
import { useUiT } from '@/lib/use-ui-locale';

export function UserProfilePanel() {
  const { user, activeTenant, tenantLanguage, uiLanguagePreference, refresh } = useAuth();
  const { t } = useUiT();
  const [preference, setPreference] = useState<UiLanguagePreference>(uiLanguagePreference);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPreference(uiLanguagePreference);
  }, [uiLanguagePreference, user?.id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateUserPreferences({ ui_language: preference });
      setNotice(t('profileLangSaved'));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const dirty = preference !== uiLanguagePreference;

  const prefLabel = (id: UiLanguagePreference) => {
    if (id === 'auto') return t('profileLangAuto');
    return id === 'en' ? t('languageEnglish') : t('languageSpanish');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="size-6" aria-hidden />
          {t('profileTitle')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('profileSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profileAccount')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">{t('usersName')}:</span>{' '}
            <span className="font-medium">{user?.nombre}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{t('usersEmail')}:</span>{' '}
            <span className="font-mono text-xs">{user?.email}</span>
          </p>
          {activeTenant ? (
            <p>
              <span className="text-muted-foreground">{t('profileActiveTenant')}:</span>{' '}
              <span className="font-medium">{activeTenant.nombre}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-violet-500/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="size-4 text-violet-500" />
            {t('profileUiLanguageTitle')}
          </CardTitle>
          <CardDescription className="text-sm">{t('profileUiLanguageDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm max-w-md">
            <span className="text-muted-foreground">{t('profileUiLanguageLabel')}</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={preference}
              onChange={(e) => setPreference(e.target.value as UiLanguagePreference)}
            >
              {UI_LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {prefLabel(opt.id)}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 rounded-md px-2.5 py-2">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-md px-2.5 py-2">
              {notice}
            </p>
          ) : null}

          <Button type="button" size="sm" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
            {t('save')}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">{t('profileTenantLangTitle')}</CardTitle>
          <CardDescription className="text-sm">{t('profileTenantLangDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">{t('languageCurrent')}:</span>{' '}
            <span className="font-medium">
              {tenantLanguage === 'en' ? t('languageEnglish') : t('languageSpanish')}
            </span>
            {activeTenant ? (
              <>
                {' '}
                · <span className="font-mono text-xs">{activeTenant.nombre}</span>
              </>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('profileTenantLangHint')}</p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            {TENANT_LANGUAGE_OPTIONS.map((opt) => (
              <li key={opt.id}>
                {opt.id === tenantLanguage ? '● ' : ''}
                {opt.id === 'en' ? t('languageEnglish') : t('languageSpanish')}:{' '}
                {opt.id === 'en' ? t('profileTenantEnCols') : t('profileTenantEsCols')}
              </li>
            ))}
          </ul>
          <Link href="/admin" className="inline-block text-xs text-violet-600 hover:underline dark:text-violet-400 mt-2">
            {t('profileTenantLangAdminLink')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
