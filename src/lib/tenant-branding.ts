import { resolveApiUrl } from '@/lib/api-base';

/** White-label / tenant branding (mirror backend TenantBrandingRead). */
export type TenantBranding = {
  product_name?: string | null;
  workspace_name?: string | null;
  tagline?: string | null;
  login_headline?: string | null;
  login_subtitle?: string | null;
  login_message?: string | null;
  logo_url?: string | null;
  logo_dark_url?: string | null;
  logo_secondary_url?: string | null;
  favicon_url?: string | null;
  login_banner_url?: string | null;
  dashboard_banner_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  sidebar_color?: string | null;
  default_theme?: 'light' | 'dark' | 'system' | null;
  allow_theme_toggle?: boolean;
  custom_domain?: string | null;
  custom_domain_verified?: boolean;
  report_company_name?: string | null;
  report_footer?: string | null;
  report_watermark?: string | null;
  report_classification?: string | null;
  email_from_name?: string | null;
  email_footer_html?: string | null;
};

export type TenantBrandingPublic = {
  tenant_id: string;
  slug: string;
  nombre: string;
  branding: TenantBranding;
};

export const DEFAULT_TENANT_BRANDING: TenantBranding = {
  product_name: 'Phantom',
  tagline: 'Security Operations Platform',
  login_headline: 'Iniciar sesión',
  login_subtitle: 'Multi-tenant · RBAC · SecOps',
  login_message: 'Authorized Security Operations Platform',
  default_theme: 'system',
  allow_theme_toggle: true,
  report_classification: 'CONFIDENCIAL',
};

export const BRANDING_ASSET_SLOTS = [
  { id: 'logo', label: 'Logo principal', hint: 'Sidebar, informes, emails' },
  { id: 'logo_dark', label: 'Logo (modo oscuro)', hint: 'Variante para fondos oscuros' },
  { id: 'logo_secondary', label: 'Logo secundario', hint: 'Cliente / co-branding (esquina)' },
  { id: 'favicon', label: 'Favicon', hint: 'Pestaña del navegador' },
  { id: 'login_banner', label: 'Banner login', hint: 'Fondo o hero del login' },
  { id: 'dashboard_banner', label: 'Banner dashboard', hint: 'Cabecera del workspace' },
] as const;

export type BrandingAssetSlot = (typeof BRANDING_ASSET_SLOTS)[number]['id'];

export function mergeBranding(partial?: TenantBranding | null): TenantBranding {
  return { ...DEFAULT_TENANT_BRANDING, ...(partial ?? {}) };
}

export function brandingDisplayName(branding: TenantBranding, tenantNombre: string): string {
  return branding.workspace_name?.trim() || tenantNombre;
}

export function brandingProductName(branding: TenantBranding): string {
  return branding.product_name?.trim() || DEFAULT_TENANT_BRANDING.product_name!;
}

export function resolveBrandingAssetUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return resolveApiUrl(url);
}

export function pickLogoUrl(branding: TenantBranding, isDark: boolean): string | undefined {
  const primary = isDark ? branding.logo_dark_url || branding.logo_url : branding.logo_url;
  return resolveBrandingAssetUrl(primary);
}

/** Inyecta variables CSS de marca en :root (no pisa tema global salvo --tenant-*). */
export function applyTenantBrandingCss(branding: TenantBranding): () => void {
  const root = document.documentElement;
  const prev: Record<string, string> = {};

  const set = (name: string, value?: string | null) => {
    prev[name] = root.style.getPropertyValue(name);
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };

  set('--tenant-primary', branding.primary_color);
  set('--tenant-accent', branding.accent_color);
  set('--tenant-sidebar', branding.sidebar_color);

  if (branding.primary_color) {
    set('--primary', branding.primary_color);
  }
  if (branding.accent_color) {
    set('--ring', branding.accent_color);
  }
  if (branding.sidebar_color) {
    set('--sidebar', branding.sidebar_color);
  }

  return () => {
    for (const [name, value] of Object.entries(prev)) {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    }
  };
}

export function applyFavicon(url?: string | null) {
  const href = resolveBrandingAssetUrl(url);
  if (!href) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
