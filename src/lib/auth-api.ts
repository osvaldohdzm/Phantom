import { resolveApiUrl } from '@/lib/api-base';
import { authHeaders, clearSession, persistSession } from '@/lib/auth-storage';

import type { TenantBranding } from '@/lib/tenant-branding';

export type UserRole =
  | 'platform_admin'
  | 'tenant_admin'
  | 'analyst'
  | 'client_viewer';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
}

export interface AuthTenant {
  id: string;
  slug: string;
  nombre: string;
  role: UserRole;
  branding?: TenantBranding | null;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: AuthUser;
  active_tenant_id: string;
  role: UserRole;
  tenants: AuthTenant[];
  branding?: TenantBranding | null;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

export async function login(
  email: string,
  password: string,
  tenantId?: string
): Promise<AuthSession> {
  const session = await authFetch<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, tenant_id: tenantId ?? null }),
  });
  persistSession(session.access_token, session.active_tenant_id);
  return session;
}

export async function fetchMe(): Promise<AuthSession> {
  const me = await authFetch<{
    user: AuthUser;
    active_tenant_id: string;
    role: UserRole;
    tenants: AuthTenant[];
    branding?: TenantBranding | null;
  }>('/api/v1/auth/me');
  const token = (await import('@/lib/auth-storage')).getStoredToken();
  if (!token) throw new Error('Sin sesión');
  return {
    access_token: token,
    token_type: 'bearer',
    user: me.user,
    active_tenant_id: me.active_tenant_id,
    role: me.role,
    tenants: me.tenants,
    branding: me.branding ?? null,
  };
}

export async function switchTenant(tenantId: string): Promise<AuthSession> {
  const session = await authFetch<AuthSession>('/api/v1/auth/switch-tenant', {
    method: 'POST',
    body: JSON.stringify({ tenant_id: tenantId }),
  });
  persistSession(session.access_token, session.active_tenant_id);
  return session;
}

export function logout() {
  clearSession();
}

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: 'Admin plataforma',
  tenant_admin: 'Admin tenant',
  analyst: 'Analista',
  client_viewer: 'Cliente',
};

export function isClientViewer(role: UserRole) {
  return role === 'client_viewer';
}

export function canWriteSecOps(role: UserRole) {
  return role !== 'client_viewer';
}

export function canAdminTenant(role: UserRole) {
  return role === 'platform_admin' || role === 'tenant_admin';
}

export function canManageTenants(role: UserRole) {
  return role === 'platform_admin';
}

export interface AdminTenant {
  id: string;
  slug: string;
  nombre: string;
  descripcion?: string | null;
  is_active: boolean;
  created_at: string;
  users_count: number;
  engagements_count: number;
}

export async function listTenants(includeInactive = false): Promise<AdminTenant[]> {
  const q = includeInactive ? '?include_inactive=true' : '';
  return authFetch<AdminTenant[]>(`/api/v1/admin/tenants${q}`);
}

export async function createTenant(input: {
  slug: string;
  nombre: string;
  descripcion?: string;
  add_me_as_admin?: boolean;
}): Promise<AdminTenant> {
  return authFetch<AdminTenant>('/api/v1/admin/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTenant(
  tenantId: string,
  input: {
    slug?: string;
    nombre?: string;
    descripcion?: string | null;
    is_active?: boolean;
  }
): Promise<AdminTenant> {
  return authFetch<AdminTenant>(`/api/v1/admin/tenants/${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteTenant(tenantId: string): Promise<{ deleted: boolean; id: string }> {
  return authFetch(`/api/v1/admin/tenants/${tenantId}`, { method: 'DELETE' });
}

export interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  is_active: boolean;
  role: UserRole;
}

export interface AdminMembership {
  membership_id: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_nombre: string;
  role: UserRole;
}

export interface AdminUserWithMemberships {
  id: string;
  email: string;
  nombre: string;
  is_active: boolean;
  memberships: AdminMembership[];
}

export async function listUsersWithMemberships(): Promise<AdminUserWithMemberships[]> {
  return authFetch<AdminUserWithMemberships[]>('/api/v1/admin/users');
}

export async function setUserMemberships(
  userId: string,
  memberships: { tenant_id: string; role: UserRole }[]
): Promise<AdminUserWithMemberships> {
  return authFetch<AdminUserWithMemberships>(`/api/v1/admin/users/${userId}/memberships`, {
    method: 'PUT',
    body: JSON.stringify({ memberships }),
  });
}

export async function removeUserMembership(
  userId: string,
  tenantId: string
): Promise<{ removed: boolean }> {
  return authFetch(`/api/v1/admin/users/${userId}/memberships/${tenantId}`, {
    method: 'DELETE',
  });
}

export interface AdminAuditEvent {
  id: string;
  action: string;
  actor_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  ip_address?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export async function listTenantUsers(): Promise<AdminUser[]> {
  return authFetch<AdminUser[]>('/api/v1/admin/tenant-users');
}

export async function createTenantUser(input: {
  email: string;
  nombre: string;
  password: string;
  role: UserRole;
  tenant_ids?: string[];
}): Promise<AdminUser> {
  return authFetch<AdminUser>('/api/v1/admin/tenant-users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTenantUserRole(
  userId: string,
  role: UserRole,
  tenantId?: string
): Promise<AdminUser> {
  return authFetch<AdminUser>(`/api/v1/admin/tenant-users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role, tenant_id: tenantId ?? null }),
  });
}

export async function listAuditEvents(limit = 50): Promise<AdminAuditEvent[]> {
  return authFetch<AdminAuditEvent[]>(`/api/v1/admin/audit-events?limit=${limit}`);
}

export type AdminDatabaseRuntime = {
  active: boolean;
  read_only: boolean;
  mode: string;
  driver?: string | null;
  connection_name: string;
  database_url_masked: string;
  host?: string | null;
  port?: number | null;
  database?: string | null;
  username?: string | null;
  password_masked?: string | null;
  query?: string | null;
  redis_url_masked: string;
  redis_host?: string | null;
  redis_port: number;
  redis_db: string;
  auth_required: boolean;
  jwt_expire_minutes: number;
  can_switch_from_ui: boolean;
  switch_note: string;
};

export type AdminDeploymentProfile = {
  id: string;
  label: string;
  description: string;
  recommended_for: string[];
  env_file_name: string;
  database_mode: string;
  limitations?: string[];
};

export type AdminDeploymentEnv = {
  profile_id: string;
  env_content: string;
  filename: string;
};

export async function getDatabaseRuntimeConfig(): Promise<AdminDatabaseRuntime> {
  return authFetch<AdminDatabaseRuntime>('/api/v1/admin/database/runtime');
}

export async function listDeploymentProfiles(): Promise<AdminDeploymentProfile[]> {
  return authFetch<AdminDeploymentProfile[]>('/api/v1/admin/database/deployment-profiles');
}

export async function downloadDeploymentEnv(profileId: string): Promise<AdminDeploymentEnv> {
  return authFetch<AdminDeploymentEnv>(`/api/v1/admin/database/deployment-env/${profileId}`);
}
