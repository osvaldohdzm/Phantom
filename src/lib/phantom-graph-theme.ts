/** Shared vis-network + canvas theming for Phantom Engine maps */

export type PhantomGraphTheme = {
  canvasClass: string;
  edgeColor: string;
  edgeLabel: string;
  nodeShadow: string;
  commandFont: string;
  labelFont: string;
  navBtn: string;
};

export function getPhantomGraphTheme(isDark: boolean): PhantomGraphTheme {
  if (isDark) {
    return {
      canvasClass: 'phantom-map-stage phantom-map-stage--dark',
      edgeColor: 'rgba(34,211,238,0.35)',
      edgeLabel: '#94a3b8',
      nodeShadow: 'rgba(0,0,0,0.45)',
      commandFont: '#e2e8f0',
      labelFont: '#f8fafc',
      navBtn: 'rgba(15,23,42,0.85)',
    };
  }
  return {
    canvasClass: 'phantom-map-stage phantom-map-stage--light',
    edgeColor: 'rgba(14,116,144,0.42)',
    edgeLabel: '#475569',
    nodeShadow: 'rgba(15,23,42,0.18)',
    commandFont: '#f1f5f9',
    labelFont: '#ffffff',
    navBtn: 'rgba(255,255,255,0.92)',
  };
}

/** Node palette — semantic kill-chain colors */
export const PHANTOM_NODE_PALETTE = {
  attacker: { bg: '#dc2626', border: '#f87171', glow: '#ef4444' },
  target: { bg: '#16a34a', border: '#4ade80', glow: '#22c55e' },
  initial_target: { bg: '#1e3a8a', border: '#60a5fa', glow: '#3b82f6' },
  derived_target: { bg: '#065f46', border: '#34d399', glow: '#10b981' },
  host: { bg: '#16a34a', border: '#4ade80', glow: '#22c55e' },
  command: { bg: '#0f172a', border: '#22d3ee', glow: '#06b6d4' },
  port: { bg: '#0891b2', border: '#22d3ee', glow: '#06b6d4' },
  service: { bg: '#2563eb', border: '#60a5fa', glow: '#3b82f6' },
  technology: { bg: '#db2777', border: '#f472b6', glow: '#ec4899' },
  vulnerability: { bg: '#dc2626', border: '#fca5a5', glow: '#ef4444' },
  exploit: { bg: '#ea580c', border: '#fb923c', glow: '#f97316' },
  payload: { bg: '#c2410c', border: '#fdba74', glow: '#f97316' },
  session: { bg: '#6d28d9', border: '#a78bfa', glow: '#8b5cf6' },
  privesc: { bg: '#581c87', border: '#c084fc', glow: '#a855f7' },
  credential: { bg: '#ca8a04', border: '#facc15', glow: '#eab308' },
  flag: { bg: '#15803d', border: '#4ade80', glow: '#22c55e' },
  loot: { bg: '#b45309', border: '#fcd34d', glow: '#f59e0b' },
  pivot: { bg: '#7c3aed', border: '#c4b5fd', glow: '#8b5cf6' },
  evidence: { bg: '#475569', border: '#94a3b8', glow: '#64748b' },
  objective: { bg: '#0e7490', border: '#22d3ee', glow: '#06b6d4' },
  note: { bg: '#64748b', border: '#cbd5e1', glow: '#94a3b8' },
  route: { bg: '#d97706', border: '#fbbf24', glow: '#f59e0b' },
  vector: { bg: '#dc2626', border: '#f87171', glow: '#ef4444' },
  phase: { bg: '#475569', border: '#94a3b8', glow: '#64748b' },
  subnet: { bg: '#4f46e5', border: '#818cf8', glow: '#6366f1' },
  domain: { bg: '#0284c7', border: '#38bdf8', glow: '#0ea5e9' },
  firewall: { bg: '#57534e', border: '#a8a29e', glow: '#78716c' },
  cloud: { bg: '#0891b2', border: '#22d3ee', glow: '#06b6d4' },
  router: { bg: '#d97706', border: '#fbbf24', glow: '#f59e0b' },
  switch: { bg: '#0f766e', border: '#2dd4bf', glow: '#14b8a6' },
  database: { bg: '#be185d', border: '#f472b6', glow: '#ec4899' },
  server: { bg: '#16a34a', border: '#4ade80', glow: '#22c55e' },
  mobile: { bg: '#334155', border: '#94a3b8', glow: '#64748b' },
  wifi: { bg: '#0284c7', border: '#38bdf8', glow: '#0ea5e9' },
  account: { bg: '#7c3aed', border: '#c4b5fd', glow: '#8b5cf6' },
  network: { bg: '#4f46e5', border: '#818cf8', glow: '#6366f1' },
  organization: { bg: '#475569', border: '#94a3b8', glow: '#64748b' },
  file: { bg: '#64748b', border: '#cbd5e1', glow: '#94a3b8' },
  resource: { bg: '#0e7490', border: '#22d3ee', glow: '#06b6d4' },
} as const;

export const PHANTOM_EDGE_PALETTE = {
  network: { color: '#64748b', width: 1.5, dashes: false },
  lateral_movement: { color: '#ef4444', width: 2.5, dashes: false },
  pivot: { color: '#f97316', width: 2, dashes: true },
  credential_flow: { color: '#eab308', width: 2, dashes: true },
  exploit: { color: '#dc2626', width: 2.2, dashes: false },
  trust: { color: '#8b5cf6', width: 1.5, dashes: false },
  dns: { color: '#06b6d4', width: 1, dashes: true },
  data: { color: '#10b981', width: 1.5, dashes: true },
  generic: { color: '#94a3b8', width: 1.2, dashes: false },
} as const;
