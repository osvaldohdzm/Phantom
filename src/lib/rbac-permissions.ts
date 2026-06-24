import type { UserRole } from '@/lib/auth-api';

/** Capacidades alineadas con backend/app/services/rbac.py */
export type Capability =
  | 'platform:tenants_manage'
  | 'platform:database_view'
  | 'platform:audit_global'
  | 'platform:users_cross_tenant'
  | 'tenant:settings_write'
  | 'tenant:users_manage'
  | 'tenant:audit_view'
  | 'secops:write'
  | 'secops:read'
  | 'portal:view';

const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  platform_admin: [
    'platform:tenants_manage',
    'platform:database_view',
    'platform:audit_global',
    'platform:users_cross_tenant',
    'tenant:settings_write',
    'tenant:users_manage',
    'tenant:audit_view',
    'secops:write',
    'secops:read',
  ],
  tenant_admin: [
    'tenant:settings_write',
    'tenant:users_manage',
    'tenant:audit_view',
    'secops:write',
    'secops:read',
  ],
  analyst: ['secops:write', 'secops:read'],
  client_viewer: ['portal:view', 'secops:read'],
};

export function hasCapability(role: UserRole | null, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function canViewTenantAudit(role: UserRole | null): boolean {
  return hasCapability(role, 'tenant:audit_view');
}

export function canViewPlatformAudit(
  role: UserRole | null,
  tenants?: { role: UserRole }[]
): boolean {
  if (hasCapability(role, 'platform:audit_global')) return true;
  return tenants?.some((t) => t.role === 'platform_admin') ?? false;
}

export function canManageTenantSettings(role: UserRole | null): boolean {
  return hasCapability(role, 'tenant:settings_write');
}
