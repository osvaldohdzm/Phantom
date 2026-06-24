"""Capacidades RBAC por rol — base para permisos granulares multi-tenant."""

from __future__ import annotations

from enum import Enum

from app.models.auth import UserRole

PLATFORM_ADMIN = UserRole.platform_admin
TENANT_ADMIN = UserRole.tenant_admin
ANALYST = UserRole.analyst
CLIENT = UserRole.client_viewer

ADMIN_ROLES = frozenset({PLATFORM_ADMIN, TENANT_ADMIN})
WRITE_ROLES = frozenset({PLATFORM_ADMIN, TENANT_ADMIN, ANALYST})


class Capability(str, Enum):
    # Plataforma
    platform_tenants_manage = "platform:tenants_manage"
    platform_database_view = "platform:database_view"
    platform_audit_global = "platform:audit_global"
    platform_users_cross_tenant = "platform:users_cross_tenant"

    # Tenant
    tenant_settings_write = "tenant:settings_write"
    tenant_users_manage = "tenant:users_manage"
    tenant_audit_view = "tenant:audit_view"

    # Operaciones SecOps
    secops_write = "secops:write"
    secops_read = "secops:read"
    portal_view = "portal:view"


ROLE_CAPABILITIES: dict[UserRole, frozenset[Capability]] = {
    PLATFORM_ADMIN: frozenset(Capability),
    TENANT_ADMIN: frozenset(
        {
            Capability.tenant_settings_write,
            Capability.tenant_users_manage,
            Capability.tenant_audit_view,
            Capability.secops_write,
            Capability.secops_read,
        }
    ),
    ANALYST: frozenset({Capability.secops_write, Capability.secops_read}),
    CLIENT: frozenset({Capability.portal_view, Capability.secops_read}),
}


def role_has_capability(role: UserRole, capability: Capability) -> bool:
    return capability in ROLE_CAPABILITIES.get(role, frozenset())


def is_admin_role(role: UserRole) -> bool:
    return role in ADMIN_ROLES


def is_write_role(role: UserRole) -> bool:
    return role in WRITE_ROLES
