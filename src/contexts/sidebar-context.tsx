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

const STORAGE_KEY = 'spectre.secops.sidebar.open.v1';

type SidebarContextValue = {
  open: boolean;
  hydrated: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '0') setOpen(false);
      else if (stored === '1') setOpen(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open, hydrated]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, hydrated, toggle, setOpen }),
    [open, hydrated, toggle]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar debe usarse dentro de SidebarProvider');
  }
  return ctx;
}

export function useSidebarOptional() {
  return useContext(SidebarContext);
}
