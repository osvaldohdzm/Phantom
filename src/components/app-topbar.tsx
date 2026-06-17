'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, LogOut, PanelLeft, PanelLeftClose, User } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/contexts/auth-context';
import { useSidebarOptional } from '@/contexts/sidebar-context';
import { ROLE_LABELS, canAdminTenant } from '@/lib/auth-api';
import { cn } from '@/lib/utils';

function SidebarToggle({ className }: { className?: string }) {
  const sidebar = useSidebarOptional();
  if (!sidebar) return null;
  const { open, toggle } = sidebar;
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'hidden md:inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground',
        'hover:bg-muted/60 hover:text-foreground transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className
      )}
      aria-label={open ? 'Ocultar menú de navegación' : 'Mostrar menú de navegación'}
      aria-expanded={open}
      title={open ? 'Ocultar menú (⌘B)' : 'Mostrar menú (⌘B)'}
    >
      {open ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
    </button>
  );
}

export function AppTopbar({ className }: { className?: string }) {
  const { user, role, tenants, activeTenant, switchTenant, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (loading || !user) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-2 min-h-12',
          className
        )}
      >
        <SidebarToggle />
        <ThemeToggle compact />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-border bg-card/60 backdrop-blur-sm px-4 py-2 min-h-12',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <SidebarToggle />
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <Building2 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {activeTenant?.nombre ?? 'Sin tenant'}
            {role ? (
              <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">
                {ROLE_LABELS[role]}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {tenants.length > 1 ? (
          <label className="flex items-center gap-1.5 text-xs">
            <span className="sr-only">Cambiar tenant</span>
            <select
              className="h-8 max-w-[11rem] truncate rounded-md border border-border bg-background px-2 text-xs text-foreground"
              value={activeTenant?.id ?? ''}
              onChange={(e) => void switchTenant(e.target.value)}
              aria-label="Cambiar organización"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <ThemeToggle compact />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted/60"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <User className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="hidden md:inline max-w-[10rem] truncate">{user.nombre}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg"
            >
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-medium truncate">{user.nombre}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {role === 'client_viewer' ? (
                <Link
                  href="/portal"
                  className="block rounded-md px-3 py-2 text-xs hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  Portal cliente
                </Link>
              ) : (
                <Link
                  href="/"
                  className="block rounded-md px-3 py-2 text-xs hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  Tablero SecOps
                </Link>
              )}
              {role && canAdminTenant(role) ? (
                <Link
                  href="/admin"
                  className="block rounded-md px-3 py-2 text-xs hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  Administración
                </Link>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-rose-600 hover:bg-muted"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                <LogOut className="size-3.5" aria-hidden />
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
