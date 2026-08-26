"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  PORTAL_THEME_STORAGE_KEY,
  buildPortalThemeStyle,
  loadPortalThemeConfig,
  savePortalThemeConfig,
  type PortalThemeConfig,
} from "@/lib/portal/portal-themes"

type PortalThemeContextValue = {
  config: PortalThemeConfig
  setConfig: (next: PortalThemeConfig) => void
  refresh: () => void
}

const PortalThemeContext = createContext<PortalThemeContextValue | null>(null)

export function usePortalTheme() {
  const ctx = useContext(PortalThemeContext)
  if (!ctx) {
    throw new Error("usePortalTheme must be used within PortalThemeProvider")
  }
  return ctx
}

export function usePortalThemeOptional() {
  return useContext(PortalThemeContext)
}

export function PortalThemeProvider({
  children,
  /** When false, still provides context (for editor) but does not inject client chrome attrs. */
  applyChrome = true,
}: {
  children: ReactNode
  applyChrome?: boolean
}) {
  const [config, setConfigState] = useState<PortalThemeConfig>(() => loadPortalThemeConfig())

  const setConfig = useCallback((next: PortalThemeConfig) => {
    setConfigState(next)
    savePortalThemeConfig(next)
  }, [])

  const refresh = useCallback(() => {
    setConfigState(loadPortalThemeConfig())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PORTAL_THEME_STORAGE_KEY) refresh()
    }
    const onLocal = () => refresh()
    window.addEventListener("storage", onStorage)
    window.addEventListener("spectre-portal-theme-changed", onLocal as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("spectre-portal-theme-changed", onLocal as EventListener)
    }
  }, [refresh])

  const styleCss = useMemo(() => buildPortalThemeStyle(config), [config])
  const value = useMemo(() => ({ config, setConfig, refresh }), [config, setConfig, refresh])

  return (
    <PortalThemeContext.Provider value={value}>
      <style id="portal-client-theme-css" dangerouslySetInnerHTML={{ __html: styleCss }} />
      {applyChrome ? (
        <div
          data-portal-root=""
          data-portal-theme={config.id}
          className="min-h-full flex flex-col flex-1"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </PortalThemeContext.Provider>
  )
}
