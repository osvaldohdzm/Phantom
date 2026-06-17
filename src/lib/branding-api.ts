import { resolveApiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/auth-storage';
import type { TenantBranding, TenantBrandingPublic } from '@/lib/tenant-branding';

async function brandingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveApiUrl(path), {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
          : res.statusText;
    throw new Error(detail || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPublicBranding(slug: string): Promise<TenantBrandingPublic> {
  const res = await fetch(resolveApiUrl(`/api/v1/branding/public/${encodeURIComponent(slug)}`));
  if (!res.ok) {
    throw new Error('Branding no disponible');
  }
  return res.json() as Promise<TenantBrandingPublic>;
}

export async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  return brandingFetch<TenantBranding>(`/api/v1/branding/tenants/${tenantId}`);
}

export async function updateTenantBranding(
  tenantId: string,
  patch: Partial<TenantBranding>
): Promise<TenantBranding> {
  return brandingFetch<TenantBranding>(`/api/v1/branding/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function uploadBrandingAsset(
  tenantId: string,
  slot: string,
  file: File
): Promise<TenantBranding> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(resolveApiUrl(`/api/v1/branding/tenants/${tenantId}/assets/${slot}`), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Error al subir archivo');
  }
  return res.json() as Promise<TenantBranding>;
}

export async function deleteBrandingAsset(tenantId: string, slot: string): Promise<TenantBranding> {
  return brandingFetch<TenantBranding>(`/api/v1/branding/tenants/${tenantId}/assets/${slot}`, {
    method: 'DELETE',
  });
}
