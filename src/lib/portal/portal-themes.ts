/**
 * Client-portal-only theme system.
 * Themes apply under [data-portal-root] and never mutate global SecOps :root.
 */

export type PortalThemeId = 'phantom-current' | 'baxter-servicenow' | 'custom';

export type PortalPalette = {
  /** Deep header/footer (Baxter navy) */
  headerBg: string;
  headerFg: string;
  /** Primary action button */
  actionBg: string;
  actionFg: string;
  /** Links / breadcrumbs teal */
  accent: string;
  /** Teal capsules / tags */
  tagBg: string;
  tagFg: string;
  /** Page canvas */
  pageBg: string;
  /** Cards / panels */
  cardBg: string;
  cardBorder: string;
  /** Body text */
  text: string;
  textMuted: string;
  /** Form fields */
  inputBg: string;
  inputBorder: string;
  /** Focus / ring */
  ring: string;
  /** Destructive / required asterisk */
  danger: string;
  fontFamily: string;
  radius: string;
};

export type PortalThemeConfig = {
  id: PortalThemeId;
  /** When id is custom, palette is fully user-owned; otherwise palette overrides the preset. */
  palette: PortalPalette;
  /** Extra CSS injected under [data-portal-root] only (sanitized on save). */
  customCss: string;
  updatedAt: string;
};

export const PORTAL_THEME_STORAGE_KEY = 'spectre_portal_theme_config_v1';

export const PHANTOM_CURRENT_PALETTE: PortalPalette = {
  headerBg: '#1a1a2e',
  headerFg: '#f8fafc',
  actionBg: '#312e81',
  actionFg: '#ffffff',
  accent: '#7c3aed',
  tagBg: '#4c1d95',
  tagFg: '#f5f3ff',
  pageBg: '#f8fafc',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  inputBg: '#ffffff',
  inputBorder: '#cbd5e1',
  ring: '#8b5cf6',
  danger: '#dc2626',
  fontFamily: 'var(--font-roboto), ui-sans-serif, system-ui, sans-serif',
  radius: '0.75rem',
};

/** ServiceNow-style Baxter client portal (from corporate portal reference). */
export const BAXTER_SERVICENOW_PALETTE: PortalPalette = {
  headerBg: '#003399',
  headerFg: '#ffffff',
  actionBg: '#3e67b9',
  actionFg: '#ffffff',
  accent: '#1F8476',
  tagBg: '#00464F',
  tagFg: '#ffffff',
  pageBg: '#f1f1f1',
  cardBg: '#ffffff',
  cardBorder: '#dddddd',
  text: '#2e2e2e',
  textMuted: '#666666',
  inputBg: '#f5f5f5',
  inputBorder: '#939393',
  ring: '#54AC98',
  danger: '#C83C36',
  fontFamily: '"Source Sans Pro", Helvetica, Arial, sans-serif',
  radius: '0.25rem',
};

export const PORTAL_THEME_PRESETS: Record<
  Exclude<PortalThemeId, 'custom'>,
  { label: string; description: string; palette: PortalPalette }
> = {
  'phantom-current': {
    label: 'Phantom (actual)',
    description: 'Estilo actual del portal Spectre/Phantom — violeta corporativo y cards modernas.',
    palette: PHANTOM_CURRENT_PALETTE,
  },
  'baxter-servicenow': {
    label: 'Baxter (ServiceNow)',
    description: 'Portal corporativo Baxter: navy #003399, botones #3e67b9, acentos teal, forms grises.',
    palette: BAXTER_SERVICENOW_PALETTE,
  },
};

export function defaultPortalThemeConfig(id: Exclude<PortalThemeId, 'custom'> = 'baxter-servicenow'): PortalThemeConfig {
  return {
    id,
    palette: { ...PORTAL_THEME_PRESETS[id].palette },
    customCss: '',
    updatedAt: new Date().toISOString(),
  };
}

export function resolvePalette(config: PortalThemeConfig): PortalPalette {
  if (config.id === 'custom') return { ...config.palette };
  const base = PORTAL_THEME_PRESETS[config.id]?.palette ?? PHANTOM_CURRENT_PALETTE;
  return { ...base, ...config.palette };
}

/** Strip dangerous constructs; keep theme CSS readable. */
export function sanitizePortalCustomCss(raw: string): string {
  const cleaned = (raw || '')
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/-moz-binding\s*:/gi, '')
    .replace(/behavior\s*:/gi, '');
  // Cap size to avoid runaway localStorage / style injection
  return cleaned.slice(0, 80_000);
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

export function loadPortalThemeConfig(): PortalThemeConfig {
  if (typeof window === 'undefined') return defaultPortalThemeConfig('baxter-servicenow');
  try {
    const raw = localStorage.getItem(PORTAL_THEME_STORAGE_KEY);
    if (!raw) return defaultPortalThemeConfig('baxter-servicenow');
    const parsed = JSON.parse(raw) as Partial<PortalThemeConfig>;
    const id = (parsed.id ?? 'baxter-servicenow') as PortalThemeId;
    const presetBase =
      id === 'custom'
        ? PHANTOM_CURRENT_PALETTE
        : PORTAL_THEME_PRESETS[id]?.palette ?? PHANTOM_CURRENT_PALETTE;
    return {
      id,
      palette: { ...presetBase, ...(parsed.palette ?? {}) },
      customCss: sanitizePortalCustomCss(parsed.customCss ?? ''),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return defaultPortalThemeConfig('baxter-servicenow');
  }
}

export function savePortalThemeConfig(config: PortalThemeConfig): void {
  if (typeof window === 'undefined') return;
  const next: PortalThemeConfig = {
    ...config,
    customCss: sanitizePortalCustomCss(config.customCss),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(PORTAL_THEME_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('spectre-portal-theme-changed', { detail: next }));
}

/** Map palette → CSS custom properties consumed under [data-portal-root]. */
export function paletteToCssVars(palette: PortalPalette): Record<string, string> {
  return {
    '--portal-header-bg': palette.headerBg,
    '--portal-header-fg': palette.headerFg,
    '--portal-action-bg': palette.actionBg,
    '--portal-action-fg': palette.actionFg,
    '--portal-accent': palette.accent,
    '--portal-tag-bg': palette.tagBg,
    '--portal-tag-fg': palette.tagFg,
    '--portal-page-bg': palette.pageBg,
    '--portal-card-bg': palette.cardBg,
    '--portal-card-border': palette.cardBorder,
    '--portal-text': palette.text,
    '--portal-text-muted': palette.textMuted,
    '--portal-input-bg': palette.inputBg,
    '--portal-input-border': palette.inputBorder,
    '--portal-ring': palette.ring,
    '--portal-danger': palette.danger,
    '--portal-font': palette.fontFamily,
    '--portal-radius': palette.radius,
    // Bridge into shadcn semantic tokens (scoped to portal root only)
    '--background': palette.pageBg,
    '--foreground': palette.text,
    '--card': palette.cardBg,
    '--card-foreground': palette.text,
    '--popover': palette.cardBg,
    '--popover-foreground': palette.text,
    '--primary': palette.actionBg,
    '--primary-foreground': palette.actionFg,
    '--secondary': palette.inputBg,
    '--secondary-foreground': palette.text,
    '--muted': palette.inputBg,
    '--muted-foreground': palette.textMuted,
    '--accent': palette.inputBg,
    '--accent-foreground': palette.text,
    '--destructive': palette.danger,
    '--border': palette.cardBorder,
    '--input': palette.inputBorder,
    '--ring': palette.ring,
    '--radius': palette.radius,
    '--sidebar': palette.headerBg,
    '--sidebar-foreground': palette.headerFg,
    '--sidebar-primary': palette.actionBg,
    '--sidebar-primary-foreground': palette.actionFg,
    '--sidebar-accent': palette.tagBg,
    '--sidebar-accent-foreground': palette.tagFg,
    '--sidebar-border': palette.cardBorder,
    '--sidebar-ring': palette.ring,
  };
}

/**
 * Structural CSS for Baxter-like chrome (header strip, cards, inputs).
 * Applied only when theme is active under [data-portal-root].
 */
export function buildPortalThemeStructuralCss(themeId: PortalThemeId): string {
  const base = `
[data-portal-root] {
  font-family: var(--portal-font);
  background-color: var(--portal-page-bg);
  color: var(--portal-text);
  min-height: 100%;
}
[data-portal-root] .portal-theme-header {
  background: var(--portal-header-bg);
  color: var(--portal-header-fg);
  border-bottom: 0;
}
[data-portal-root] .portal-theme-header a {
  color: var(--portal-header-fg);
}
[data-portal-root] .portal-theme-subheader {
  background: #ffffff;
  border-bottom: 1px solid var(--portal-card-border);
  color: var(--portal-text-muted);
}
[data-portal-root] .portal-theme-subheader a {
  color: var(--portal-accent);
  text-decoration: none;
}
[data-portal-root] .portal-theme-subheader a:hover {
  text-decoration: underline;
}
[data-portal-root] .portal-theme-footer {
  background: var(--portal-header-bg);
  color: var(--portal-header-fg);
}
[data-portal-root] .portal-theme-card,
[data-portal-root] [data-slot="card"] {
  background: var(--portal-card-bg);
  border-color: var(--portal-card-border);
  border-radius: var(--portal-radius);
  box-shadow: none;
}
[data-portal-root] [data-slot="button"][data-variant="default"],
[data-portal-root] .portal-theme-btn-primary {
  background: var(--portal-action-bg) !important;
  color: var(--portal-action-fg) !important;
  border-color: transparent !important;
  border-radius: var(--portal-radius);
}
[data-portal-root] input:not([type="checkbox"]):not([type="radio"]),
[data-portal-root] select,
[data-portal-root] textarea,
[data-portal-root] [data-slot="input"],
[data-portal-root] [data-slot="textarea"] {
  background-color: var(--portal-input-bg) !important;
  border-color: var(--portal-input-border) !important;
  border-radius: var(--portal-radius);
  color: var(--portal-text);
}
[data-portal-root] input:focus,
[data-portal-root] select:focus,
[data-portal-root] textarea:focus,
[data-portal-root] [data-slot="input"]:focus-visible,
[data-portal-root] [data-slot="textarea"]:focus-visible {
  outline: 2px solid var(--portal-ring);
  outline-offset: 1px;
  border-color: var(--portal-ring) !important;
  box-shadow: none;
}
[data-portal-root] .portal-theme-tag {
  display: inline-flex;
  align-items: center;
  background: var(--portal-tag-bg);
  color: var(--portal-tag-fg);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}
[data-portal-root] .portal-theme-required {
  color: var(--portal-danger);
}
[data-portal-root] a.text-primary,
[data-portal-root] .text-primary {
  color: var(--portal-accent);
}
`;

  if (themeId === 'baxter-servicenow') {
    return (
      base +
      `
[data-portal-root][data-portal-theme="baxter-servicenow"] .portal-theme-header {
  min-height: 3.25rem;
}
[data-portal-root][data-portal-theme="baxter-servicenow"] .portal-theme-header .portal-brand-title {
  font-style: italic;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 1.35rem;
}
[data-portal-root][data-portal-theme="baxter-servicenow"] main {
  max-width: 72rem;
}
`
    );
  }

  return base;
}

export function buildPortalThemeStyle(config: PortalThemeConfig): string {
  const palette = resolvePalette(config);
  const vars = paletteToCssVars(palette);
  const varBlock = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const structural = buildPortalThemeStructuralCss(config.id);
  const custom = sanitizePortalCustomCss(config.customCss);
  const customScoped =
    custom.trim().length > 0
      ? `\n/* custom portal CSS */\n${custom}`
      : '';
  return `[data-portal-root] {\n${varBlock}\n}\n${structural}${customScoped}`;
}

export function cloneThemeConfig(config: PortalThemeConfig): PortalThemeConfig {
  return {
    id: config.id,
    palette: { ...config.palette },
    customCss: config.customCss,
    updatedAt: config.updatedAt,
  };
}

export function createThemeFromPreset(id: Exclude<PortalThemeId, 'custom'>): PortalThemeConfig {
  return defaultPortalThemeConfig(id);
}
