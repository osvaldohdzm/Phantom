"use client"

import { useMemo, useState, type ChangeEvent } from "react"
import { Check, Palette, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePortalTheme } from "@/components/portal/PortalThemeProvider"
import {
  PORTAL_THEME_PRESETS,
  cloneThemeConfig,
  createThemeFromPreset,
  resolvePalette,
  type PortalPalette,
  type PortalThemeId,
} from "@/lib/portal/portal-themes"
import { cn } from "@/lib/utils"

const PALETTE_FIELDS: Array<{ key: keyof PortalPalette; label: string; hint?: string }> = [
  { key: "headerBg", label: "Header / footer", hint: "Navy Baxter #003399" },
  { key: "headerFg", label: "Header text" },
  { key: "actionBg", label: "Primary / CTA", hint: "Botón Request #3e67b9" },
  { key: "actionFg", label: "Primary text" },
  { key: "accent", label: "Links / accent", hint: "Teal breadcrumbs #1F8476" },
  { key: "tagBg", label: "Tag / capsule", hint: "Required info pills" },
  { key: "tagFg", label: "Tag text" },
  { key: "pageBg", label: "Page background" },
  { key: "cardBg", label: "Card / panel" },
  { key: "cardBorder", label: "Card border" },
  { key: "text", label: "Body text" },
  { key: "textMuted", label: "Muted text" },
  { key: "inputBg", label: "Input background" },
  { key: "inputBorder", label: "Input border" },
  { key: "ring", label: "Focus ring" },
  { key: "danger", label: "Required / danger" },
  { key: "fontFamily", label: "Font family" },
  { key: "radius", label: "Border radius" },
]

const PRESET_IDS = Object.keys(PORTAL_THEME_PRESETS) as Array<Exclude<PortalThemeId, "custom">>

export function PortalThemeEditorPanel() {
  const { config, setConfig } = usePortalTheme()
  const [draft, setDraft] = useState(() => cloneThemeConfig(config))
  const [savedFlash, setSavedFlash] = useState(false)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config])
  const previewPalette = resolvePalette(draft)

  const applyPreset = (id: Exclude<PortalThemeId, "custom">) => {
    setDraft(createThemeFromPreset(id))
  }

  const updatePalette = (key: keyof PortalPalette, value: string) => {
    setDraft((prev) => ({
      ...prev,
      id: "custom",
      palette: { ...prev.palette, [key]: value },
    }))
  }

  const save = () => {
    setConfig(draft)
    setDraft(cloneThemeConfig({ ...draft, updatedAt: new Date().toISOString() }))
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
  }

  const resetDraft = () => setDraft(cloneThemeConfig(config))

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Palette className="h-5 w-5 text-primary" />
              Temas del portal cliente
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Solo afecta la vista del portal de clientes (<code className="text-xs">/portal</code> sin{" "}
              <code className="text-xs">?editor=true</code>). Presets Baxter (ServiceNow) y Phantom actual;
              puedes editar paleta y CSS custom.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!dirty} onClick={resetDraft}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button type="button" size="sm" disabled={!dirty && !savedFlash} onClick={save}>
              {savedFlash ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {savedFlash ? "Guardado" : "Guardar tema"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PRESET_IDS.map((id) => {
          const preset = PORTAL_THEME_PRESETS[id]
          const active = draft.id === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                active
                  ? "border-primary bg-muted/40 ring-2 ring-primary/30"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{preset.label}</div>
                {active && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Activo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{preset.description}</p>
              <div className="mt-3 flex gap-1.5">
                {[preset.palette.headerBg, preset.palette.actionBg, preset.palette.accent, preset.palette.pageBg, preset.palette.cardBg].map(
                  (c, i) => (
                    <span
                      key={`${id}-${i}`}
                      className="h-6 w-6 rounded-md border border-black/10"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  )
                )}
              </div>
            </button>
          )
        })}
      </div>

      {draft.id === "custom" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          Tema personalizado — al guardar se marca como <strong>custom</strong>. Elige un preset arriba para
          volver a Baxter o Phantom.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">Paleta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Variables bajo <code className="text-xs">[data-portal-root]</code>. No cambia SecOps ni el resto de la app.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTE_FIELDS.map((field) => {
            const value = draft.palette[field.key]
            const isColor = field.key !== "fontFamily" && field.key !== "radius"
            return (
              <div key={field.key} className="space-y-1.5">
                <label htmlFor={`palette-${field.key}`} className="text-xs font-medium">
                  {field.label}
                </label>
                <div className="flex gap-2">
                  {isColor ? (
                    <input
                      type="color"
                      aria-label={field.label}
                      className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      value={normalizeColorInput(value)}
                      onChange={(e) => updatePalette(field.key, e.target.value)}
                    />
                  ) : null}
                  <Input
                    id={`palette-${field.key}`}
                    value={value}
                    onChange={(e) => updatePalette(field.key, e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                {field.hint ? <p className="text-[11px] text-muted-foreground">{field.hint}</p> : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">CSS personalizado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Se inyecta solo en el portal cliente. Prefiere selectores bajo{" "}
          <code className="text-xs">[data-portal-root]</code>.
        </p>
        <textarea
          className="mt-3 min-h-[220px] w-full rounded-xl border border-input bg-transparent px-4 py-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
          value={draft.customCss}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setDraft((p) => ({
              ...p,
              id: p.id === "custom" ? "custom" : p.id,
              customCss: e.target.value,
            }))
          }
          placeholder={`[data-portal-root] .portal-theme-card {\n  border-radius: 2px;\n}`}
        />
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <h3 className="text-base font-semibold">Vista previa rápida</h3>
        <div
          className="mt-3 overflow-hidden border"
          style={{
            backgroundColor: previewPalette.pageBg,
            borderColor: previewPalette.cardBorder,
            borderRadius: previewPalette.radius,
            fontFamily: previewPalette.fontFamily,
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-sm font-semibold"
            style={{ backgroundColor: previewPalette.headerBg, color: previewPalette.headerFg }}
          >
            <span className="portal-brand-title" style={{ fontStyle: draft.id === "baxter-servicenow" ? "italic" : undefined }}>
              Portal
            </span>
            <span className="text-xs opacity-80">My Catalog · My Requests</span>
          </div>
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs"
            style={{
              backgroundColor: "#ffffff",
              borderColor: previewPalette.cardBorder,
              color: previewPalette.accent,
            }}
          >
            <span>Home › Service Catalog › Request</span>
            <span
              className="rounded border px-2 py-1"
              style={{
                backgroundColor: previewPalette.cardBg,
                borderColor: previewPalette.inputBorder,
                color: previewPalette.textMuted,
              }}
            >
              Search Catalog
            </span>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-[1fr_180px]">
            <div
              className="border p-4"
              style={{
                backgroundColor: previewPalette.cardBg,
                borderColor: previewPalette.cardBorder,
                borderRadius: previewPalette.radius,
              }}
            >
              <div className="text-sm font-semibold" style={{ color: previewPalette.text }}>
                SSL/TLS Certificate Request
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-xs font-medium" style={{ color: previewPalette.text }}>
                  Common Name <span style={{ color: previewPalette.danger }}>*</span>
                </div>
                <div
                  className="h-9 border px-2 text-xs leading-9"
                  style={{
                    backgroundColor: previewPalette.inputBg,
                    borderColor: previewPalette.inputBorder,
                    color: previewPalette.textMuted,
                    borderRadius: previewPalette.radius,
                  }}
                >
                  example.company.com
                </div>
              </div>
            </div>
            <div
              className="border p-3"
              style={{
                backgroundColor: previewPalette.cardBg,
                borderColor: previewPalette.cardBorder,
                borderRadius: previewPalette.radius,
              }}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: previewPalette.actionBg,
                  color: previewPalette.actionFg,
                  borderRadius: previewPalette.radius,
                }}
              >
                Request
              </button>
              <div
                className="mt-3 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: previewPalette.textMuted }}
              >
                Required information
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Request Type", "Common Name"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: previewPalette.tagBg, color: previewPalette.tagFg }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div
            className="px-4 py-2 text-xs"
            style={{ backgroundColor: previewPalette.headerBg, color: previewPalette.headerFg }}
          >
            Contact Information · GSD Numbers
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizeColorInput(value: string): string {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1]
    const g = v[2]
    const b = v[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return "#000000"
}
