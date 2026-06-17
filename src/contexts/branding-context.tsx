'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/contexts/auth-context';
import { fetchPublicBranding } from '@/lib/branding-api';
import {
  applyFavicon,
  applyTenantBrandingCss,
  brandingDisplayName,
  brandingProductName,
  mergeBranding,
  type TenantBranding,
} from '@/lib/tenant-branding';

type BrandingContextValue = {
  branding: TenantBranding;
  workspaceName: string;
  productName: string;
  tenantSlug: string | null;
  loading: boolean;
  /** Branding público para login (sin sesión). */
  loadPublicBranding: (slug: string) => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { activeTenant, branding: sessionBranding, ready } = useAuth();
  const { theme } = useTheme();
  const [publicBranding, setPublicBranding] = useState<TenantBranding | null>(null);
  const [publicMeta, setPublicMeta] = useState<{ nombre: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const branding = useMemo(() => {
    if (sessionBranding) return mergeBranding(sessionBranding);
    if (publicBranding) return mergeBranding(publicBranding);
    return mergeBranding(null);
  }, [sessionBranding, publicBranding]);

  const workspaceName = useMemo(() => {
    const base = activeTenant?.nombre ?? publicMeta?.nombre ?? 'Workspace';
    return brandingDisplayName(branding, base);
  }, [activeTenant?.nombre, publicMeta?.nombre, branding]);

  const productName = useMemo(() => brandingProductName(branding), [branding]);

  const tenantSlug = activeTenant?.slug ?? publicMeta?.slug ?? null;

  const loadPublicBranding = useCallback(async (slug: string) => {
    setLoading(true);
    try {
      const data = await fetchPublicBranding(slug);
      setPublicBranding(data.branding);
      setPublicMeta({ nombre: data.nombre, slug: data.slug });
    } catch {
      setPublicBranding(null);
      setPublicMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (activeTenant) {
      setPublicBranding(null);
      setPublicMeta(null);
    }
  }, [ready, activeTenant?.id]);

  useEffect(() => {
    const cleanup = applyTenantBrandingCss(branding);
    applyFavicon(branding.favicon_url);
    return cleanup;
  }, [branding, theme]);

  useEffect(() => {
    if (!branding.default_theme || branding.default_theme === 'system') return;
    if (activeTenant || publicMeta) {
      document.documentElement.classList.toggle('dark', branding.default_theme === 'dark');
    }
  }, [branding.default_theme, activeTenant, publicMeta]);

  const value = useMemo(
    () => ({
      branding,
      workspaceName,
      productName,
      tenantSlug,
      loading,
      loadPublicBranding,
    }),
    [branding, workspaceName, productName, tenantSlug, loading, loadPublicBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding debe usarse dentro de BrandingProvider');
  return ctx;
}

export function useBrandingOptional() {
  return useContext(BrandingContext);
}
