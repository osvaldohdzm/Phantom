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
import { usePathname, useRouter } from 'next/navigation';
import {
  canAdminTenant,
  canWriteSecOps,
  fetchMe,
  hasPlatformAdminAccess,
  isClientViewer,
  login as apiLogin,
  logout as apiLogout,
  switchTenant as apiSwitchTenant,
  type AuthSession,
  type AuthTenant,
  type AuthUser,
  type UserRole,
} from '@/lib/auth-api';
import { getStoredToken } from '@/lib/auth-storage';
import {
  coerceTenantLanguage,
  resolveTenantLanguage,
  type TenantLanguage,
} from '@/lib/tenant-locale';
import {
  resolveUiLanguage,
  type UiLanguagePreference,
} from '@/lib/user-preferences';
import { ForcePasswordChange } from '@/components/force-password-change';
import { InitialSetupWizard } from '@/components/initial-setup-wizard';

type AuthState = {
  user: AuthUser | null;
  role: UserRole | null;
  tenants: AuthTenant[];
  activeTenant: AuthTenant | null;
  branding: import('@/lib/tenant-branding').TenantBranding | null;
  loading: boolean;
  ready: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
  refresh: () => Promise<void>;
  canWrite: boolean;
  isClient: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  tenantLanguage: TenantLanguage;
  uiLanguage: TenantLanguage;
  uiLanguagePreference: UiLanguagePreference;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function tenantFromSession(session: AuthSession): AuthTenant | null {
  return session.tenants.find((t) => t.id === session.active_tenant_id) ?? session.tenants[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    tenants: [],
    activeTenant: null,
    branding: null,
    loading: true,
    ready: false,
  });

  const applySession = useCallback((session: AuthSession) => {
    const active = tenantFromSession(session);
    setState({
      user: session.user,
      role: session.role,
      tenants: session.tenants,
      activeTenant: active,
      branding: session.branding ?? active?.branding ?? null,
      loading: false,
      ready: true,
    });
  }, []);

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setState((s) => ({ ...s, loading: false, ready: true }));
      return;
    }
    try {
      const session = await fetchMe();
      applySession(session);
    } catch {
      apiLogout();
      setState({
        user: null,
        role: null,
        tenants: [],
        activeTenant: null,
        branding: null,
        loading: false,
        ready: true,
      });
    }
  }, [applySession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsInitialSetup = useMemo(
    () =>
      Boolean(state.user) &&
      !state.user?.must_change_password &&
      !state.user?.initial_setup_complete &&
      (state.role ? hasPlatformAdminAccess(state.role, state.tenants) : false),
    [state.user, state.role, state.tenants]
  );

  useEffect(() => {
    if (!state.ready || state.loading) return;
    if (state.user?.must_change_password || needsInitialSetup) return;
    if (!state.user && pathname !== '/login') {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
      return;
    }
    if (state.role && isClientViewer(state.role) && pathname && !pathname.startsWith('/portal') && pathname !== '/login') {
      router.replace('/portal');
    }
  }, [state.ready, state.loading, state.user, state.role, pathname, router, needsInitialSetup]);

  const goAfterAuth = useCallback(
    (session: AuthSession) => {
      if (session.user.must_change_password) return;
      if (!session.user.initial_setup_complete && hasPlatformAdminAccess(session.role, session.tenants)) {
        return;
      }
      if (isClientViewer(session.role)) {
        router.push('/portal');
      } else {
        router.push('/');
      }
    },
    [router]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const session = await apiLogin(email, password);
        applySession(session);
        goAfterAuth(session);
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    [applySession, goAfterAuth]
  );

  const completePasswordChange = useCallback(
    (session: AuthSession) => {
      applySession(session);
      goAfterAuth(session);
    },
    [applySession, goAfterAuth]
  );

  const completeInitialSetup = useCallback(
    (session: AuthSession) => {
      applySession(session);
      goAfterAuth(session);
    },
    [applySession, goAfterAuth]
  );

  const logout = useCallback(() => {
    apiLogout();
    setState({
      user: null,
      role: null,
      tenants: [],
      activeTenant: null,
      branding: null,
      loading: false,
      ready: true,
    });
    router.push('/login');
  }, [router]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      const session = await apiSwitchTenant(tenantId);
      applySession(session);
      router.refresh();
    },
    [applySession, router]
  );

  const value = useMemo<AuthContextValue>(() => {
    const tenantLanguage = resolveTenantLanguage(state.branding);
    const uiLanguagePreference =
      (state.user?.ui_language_preference as UiLanguagePreference | undefined) ?? 'auto';
    const resolvedFromApi = state.user?.ui_language;
    const uiLanguage = coerceTenantLanguage(
      resolvedFromApi === 'es' || resolvedFromApi === 'en'
        ? resolvedFromApi
        : resolveUiLanguage(uiLanguagePreference, tenantLanguage),
      tenantLanguage
    );
    return {
      ...state,
      login,
      logout,
      switchTenant,
      refresh,
      canWrite: state.role ? canWriteSecOps(state.role) : false,
      isClient: state.role ? isClientViewer(state.role) : false,
      isAdmin: state.role ? canAdminTenant(state.role) : false,
      isPlatformAdmin: state.role ? hasPlatformAdminAccess(state.role, state.tenants) : false,
      tenantLanguage,
      uiLanguage,
      uiLanguagePreference,
    };
  }, [state, login, logout, switchTenant, refresh]);

  return (
    <AuthContext.Provider value={value}>
      {state.user?.must_change_password ? (
        <ForcePasswordChange email={state.user.email} onComplete={completePasswordChange} />
      ) : null}
      {needsInitialSetup ? (
        <InitialSetupWizard onComplete={completeInitialSetup} />
      ) : null}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
