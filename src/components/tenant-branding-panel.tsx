'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Globe, ImageIcon, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useUiT } from '@/lib/use-ui-locale';
import { CatalogFieldConfigPanel } from '@/components/catalog-field-config-panel';
import {
  hasPlatformAdminAccess,
  listTenants,
  type AdminTenant,
} from '@/lib/auth-api';
import {
  deleteBrandingAsset,
  getTenantBranding,
  updateTenantBranding,
  uploadBrandingAsset,
} from '@/lib/branding-api';
import {
  BRANDING_ASSET_SLOTS,
  mergeBranding,
  resolveBrandingAssetUrl,
  type BrandingAssetSlot,
  type TenantBranding,
} from '@/lib/tenant-branding';
import type { TenantLanguage } from '@/lib/tenant-locale';
import { uiFormat } from '@/lib/ui-locale';

function langLabel(t: (k: import('@/lib/ui-locale').UiMessageKey) => string, lang: TenantLanguage) {
  return lang === 'en' ? t('languageEnglish') : t('languageSpanish');
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          type="color"
          className="h-9 w-12 shrink-0 cursor-pointer p-1"
          value={value || '#6366f1'}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          className="h-9 font-mono text-xs"
          placeholder="#6366f1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function AssetSlotCard({
  slot,
  label,
  hint,
  url,
  busy,
  onUpload,
  onDelete,
}: {
  slot: BrandingAssetSlot;
  label: string;
  hint: string;
  url?: string | null;
  busy: boolean;
  onUpload: (slot: BrandingAssetSlot, file: File) => void;
  onDelete: (slot: BrandingAssetSlot) => void;
}) {
  const src = resolveBrandingAssetUrl(url);
  return (
    <div className="rounded-lg border border-border/70 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
        {src ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => onDelete(slot)}>
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/30 overflow-hidden">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="max-h-full max-w-full object-contain p-2" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground/50" />
        )}
      </div>
      <label className="flex">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(slot, file);
            e.target.value = '';
          }}
        />
        <span className="inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background text-[11px] hover:bg-muted/60">
          Subir imagen
        </span>
      </label>
    </div>
  );
}

export function TenantBrandingPanel() {
  const { role, tenants: sessionTenants, activeTenant, tenantLanguage, refresh } = useAuth();
  const { t } = useUiT();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [form, setForm] = useState<TenantBranding>(mergeBranding(null));
  const [savedForm, setSavedForm] = useState<TenantBranding>(mergeBranding(null));
  const [savedLanguage, setSavedLanguage] = useState<TenantLanguage>('es');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageApplied, setLanguageApplied] = useState(false);
  const [assetBusy, setAssetBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isPlatform = role ? hasPlatformAdminAccess(role, sessionTenants) : false;
  const selectedLanguage = (form.language ?? 'es') as TenantLanguage;
  const languageDirty = selectedLanguage !== savedLanguage;
  const editingActiveTenant = Boolean(activeTenant?.id && tenantId === activeTenant.id);
  const sessionMatchesSaved =
    editingActiveTenant && savedLanguage === tenantLanguage;

  const otherFieldsDirty = useMemo(() => {
    const normalized = { ...form, language: savedForm.language ?? 'es' };
    return JSON.stringify(normalized) !== JSON.stringify(savedForm);
  }, [form, savedForm]);

  useEffect(() => {
    if (!activeTenant) return;
    setTenantId((prev) => prev || activeTenant.id);
  }, [activeTenant]);

  useEffect(() => {
    if (!isPlatform) return;
    void listTenants().then(setTenants).catch(() => setTenants([]));
  }, [isPlatform]);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantBranding(id);
      const merged = mergeBranding(data);
      setForm(merged);
      setSavedForm(merged);
      setSavedLanguage((merged.language ?? 'es') as TenantLanguage);
      setLanguageApplied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) void load(tenantId);
  }, [tenantId, load]);

  const patch = (partial: Partial<TenantBranding>) => {
    setLanguageApplied(false);
    setForm((f) => ({ ...f, ...partial }));
  };

  const applyOperatingLanguage = async () => {
    if (!tenantId || !languageDirty) return;
    const label = langLabel(t, selectedLanguage);
    const ok = window.confirm(uiFormat(t('tenantOpLangConfirm'), { lang: label }));
    if (!ok) return;

    setSavingLanguage(true);
    setError(null);
    setNotice(null);
    setLanguageApplied(false);
    try {
      const updated = await updateTenantBranding(tenantId, { language: selectedLanguage });
      const merged = mergeBranding(updated);
      setForm(merged);
      setSavedForm(merged);
      setSavedLanguage((merged.language ?? 'es') as TenantLanguage);
      if (editingActiveTenant) {
        await refresh();
        setLanguageApplied(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setSavingLanguage(false);
    }
  };

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { ...form };
      if (languageDirty) {
        payload.language = savedLanguage;
      }
      const updated = await updateTenantBranding(tenantId, payload);
      const merged = mergeBranding(updated);
      setForm(merged);
      setSavedForm(merged);
      setSavedLanguage((merged.language ?? 'es') as TenantLanguage);
      setNotice(t('tenantBrandingSaved'));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (slot: BrandingAssetSlot, file: File) => {
    if (!tenantId) return;
    setAssetBusy(slot);
    setError(null);
    try {
      const updated = await uploadBrandingAsset(tenantId, slot, file);
      setForm(mergeBranding(updated));
      setNotice(`${slot} actualizado.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setAssetBusy(null);
    }
  };

  const onDeleteAsset = async (slot: BrandingAssetSlot) => {
    if (!tenantId) return;
    setAssetBusy(slot);
    try {
      const updated = await deleteBrandingAsset(tenantId, slot);
      setForm(mergeBranding(updated));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setAssetBusy(null);
    }
  };

  const urlForSlot = (slot: BrandingAssetSlot): string | null | undefined => {
    const map: Record<BrandingAssetSlot, keyof TenantBranding> = {
      logo: 'logo_url',
      logo_dark: 'logo_dark_url',
      logo_secondary: 'logo_secondary_url',
      favicon: 'favicon_url',
      login_banner: 'login_banner_url',
      dashboard_banner: 'dashboard_banner_url',
    };
    return form[map[slot]] as string | null | undefined;
  };

  return (
    <div className="space-y-6">
      {isPlatform ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('tenantOrgTitle')}</CardTitle>
            <CardDescription>{t('tenantOrgDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({t.slug})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : activeTenant ? (
        <Card className="border-violet-500/15 bg-violet-500/5">
          <CardContent className="py-3 text-sm">
            <span className="text-muted-foreground">{t('profileActiveTenant')}:</span>{' '}
            <span className="font-medium">{activeTenant.nombre}</span>
            <span className="text-muted-foreground font-mono text-xs ml-2">({activeTenant.slug})</span>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> {t('tenantLoadingBranding')}
        </div>
      ) : (
        <>
          <Card
            className={
              languageDirty
                ? 'border-amber-500/50 shadow-sm shadow-amber-500/10'
                : languageApplied
                  ? 'border-emerald-500/40'
                  : 'border-violet-500/20'
            }
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="size-4 text-violet-500" />
                {t('tenantOpLangTitle')}
              </CardTitle>
              <CardDescription>{t('tenantOpLangDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={
                    languageDirty
                      ? 'rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:text-amber-200 font-medium'
                      : 'rounded-full border border-border px-2.5 py-1 text-muted-foreground'
                  }
                >
                  {languageDirty ? t('tenantOpLangPendingChange') : t('tenantOpLangCurrentSaved')}
                  {!languageDirty ? `: ${langLabel(t, savedLanguage)}` : ''}
                </span>
                {editingActiveTenant && sessionMatchesSaved && !languageDirty ? (
                  <span className="text-muted-foreground">
                    · {t('languageCurrent')}: {langLabel(t, tenantLanguage)}
                  </span>
                ) : null}
              </div>

              <label className="flex flex-col gap-1.5 text-sm max-w-md">
                <span className="text-muted-foreground">{t('languageLabel')}</span>
                <select
                  className={`h-9 rounded-md border bg-background px-3 text-sm ${
                    languageDirty ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-input'
                  }`}
                  value={selectedLanguage}
                  onChange={(e) => patch({ language: e.target.value as TenantLanguage })}
                >
                  <option value="es">{t('languageSpanish')}</option>
                  <option value="en">{t('languageEnglish')}</option>
                </select>
              </label>

              <p className="text-[11px] text-muted-foreground leading-relaxed">{t('tenantOpLangHint')}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('tenantOpLangUiNote')}{' '}
                <Link href="/profile" className="text-violet-600 hover:underline dark:text-violet-400">
                  {t('navProfile')}
                </Link>
              </p>

              {!editingActiveTenant && isPlatform ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md px-3 py-2 flex gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  {t('tenantOpLangOtherTenant')}
                </p>
              ) : null}

              {languageApplied && editingActiveTenant ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-3 space-y-2 text-sm">
                  <p className="font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    {t('tenantOpLangSavedTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uiFormat(t('tenantOpLangSavedBody'), { lang: langLabel(t, savedLanguage) })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t('tenantOpLangReloadHint')}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      router.refresh();
                      window.location.reload();
                    }}
                  >
                    <RefreshCw className="size-3.5 mr-1.5" />
                    {t('tenantOpLangReload')}
                  </Button>
                </div>
              ) : null}

              <Button
                type="button"
                size="sm"
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!languageDirty || savingLanguage}
                onClick={() => void applyOperatingLanguage()}
              >
                {savingLanguage ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="size-3.5 mr-1.5" />
                )}
                {t('tenantOpLangApply')}
              </Button>
            </CardContent>
          </Card>

          <CatalogFieldConfigPanel
            open
            embedded
            tenantId={tenantId}
            branding={form}
            configLanguage={selectedLanguage}
            onSaved={() => {
              void refresh();
            }}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('tenantIdentityTitle')}</CardTitle>
              <CardDescription>{t('tenantIdentityDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">{t('tenantWorkspaceName')}</label>
                <Input
                  placeholder="BBVA Security Center"
                  value={form.workspace_name ?? ''}
                  onChange={(e) => patch({ workspace_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('tenantProductFallback')}</label>
                <Input
                  placeholder="Phantom"
                  value={form.product_name ?? ''}
                  onChange={(e) => patch({ product_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('tenantTagline')}</label>
                <Input
                  value={form.tagline ?? ''}
                  onChange={(e) => patch({ tagline: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('tenantLoginTitle')}</label>
                <Input
                  value={form.login_headline ?? ''}
                  onChange={(e) => patch({ login_headline: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('tenantLoginSubtitle')}</label>
                <Input
                  value={form.login_subtitle ?? ''}
                  onChange={(e) => patch({ login_subtitle: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">{t('tenantLoginSoc')}</label>
                <Input
                  placeholder="Authorized Security Operations Platform"
                  value={form.login_message ?? ''}
                  onChange={(e) => patch({ login_message: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Logos e imágenes</CardTitle>
              <CardDescription>Sidebar, login, favicon, banners</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BRANDING_ASSET_SLOTS.map(({ id, label, hint }) => (
                <AssetSlotCard
                  key={id}
                  slot={id}
                  label={label}
                  hint={hint}
                  url={urlForSlot(id)}
                  busy={assetBusy === id}
                  onUpload={onUpload}
                  onDelete={onDeleteAsset}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Colores y tema</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <ColorField label="Color primario" value={form.primary_color ?? ''} onChange={(v) => patch({ primary_color: v })} />
              <ColorField label="Acento" value={form.accent_color ?? ''} onChange={(v) => patch({ accent_color: v })} />
              <ColorField label="Sidebar" value={form.sidebar_color ?? ''} onChange={(v) => patch({ sidebar_color: v })} />
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Tema por defecto</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.default_theme ?? 'system'}
                  onChange={(e) => patch({ default_theme: e.target.value as TenantBranding['default_theme'] })}
                >
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dominio personalizado</CardTitle>
              <CardDescription>Referencia para DNS (verificación manual / futuro)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dominio</label>
                <Input
                  placeholder="security.acme.com"
                  value={form.custom_domain ?? ''}
                  onChange={(e) => patch({ custom_domain: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.custom_domain_verified)}
                    onChange={(e) => patch({ custom_domain_verified: e.target.checked })}
                  />
                  Dominio verificado
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informes y emails</CardTitle>
              <CardDescription>PDF/HTML, Word y notificaciones con marca del cliente</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Empresa en informes</label>
                <Input
                  value={form.report_company_name ?? ''}
                  onChange={(e) => patch({ report_company_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Clasificación</label>
                <Input
                  placeholder="CONFIDENCIAL"
                  value={form.report_classification ?? ''}
                  onChange={(e) => patch({ report_classification: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Pie de informe</label>
                <Input
                  value={form.report_footer ?? ''}
                  onChange={(e) => patch({ report_footer: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Marca de agua</label>
                <Input
                  value={form.report_watermark ?? ''}
                  onChange={(e) => patch({ report_watermark: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nombre remitente email</label>
                <Input
                  value={form.email_from_name ?? ''}
                  onChange={(e) => patch({ email_from_name: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3 sticky bottom-4 z-10 rounded-lg border border-border bg-background/95 backdrop-blur px-4 py-3 shadow-lg">
            <Button type="button" onClick={() => void save()} disabled={saving || !otherFieldsDirty}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              {t('tenantBrandingSave')}
            </Button>
            {languageDirty ? (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {t('tenantOpLangPendingChange')} — {t('tenantOpLangApply')}
              </span>
            ) : null}
            {notice ? <span className="text-sm text-emerald-600">{notice}</span> : null}
            {error ? <span className="text-sm text-destructive">{error}</span> : null}
          </div>
        </>
      )}
    </div>
  );
}
