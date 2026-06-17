import type { Finding } from '@/lib/secops-api';
import type { SecopsAsset } from '@/lib/secops-api';
import { normalizeToolSourceKey } from '@/lib/finding-source-filters';
import { resolveFindingComponente } from '@/lib/finding-grouping';

export type MatrixExposure = 'interna' | 'externa';
export type MatrixAssetKind = 'equipo' | 'app';

export type VulnMatrixViewId =
  | 'completa'
  | 'internas-equipos'
  | 'externas-equipos'
  | 'internas-apps'
  | 'externas-apps';

export const VULN_MATRIX_VIEW_OPTIONS: {
  id: VulnMatrixViewId;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    id: 'completa',
    label: 'Completa (Internas + Externas)',
    short: 'Completa',
    description: 'Todas las vulnerabilidades del repositorio, todas las fuentes.',
  },
  {
    id: 'internas-equipos',
    label: 'Solo Internas · Equipos',
    short: 'Int. equipos',
    description: 'Activos internos de infraestructura, hosts y dispositivos.',
  },
  {
    id: 'externas-equipos',
    label: 'Solo Externas · Equipos',
    short: 'Ext. equipos',
    description: 'Superficie externa de infraestructura y hosts expuestos.',
  },
  {
    id: 'internas-apps',
    label: 'Solo Internas · Apps',
    short: 'Int. apps',
    description: 'Aplicaciones y servicios web en red interna.',
  },
  {
    id: 'externas-apps',
    label: 'Solo Externas · Apps',
    short: 'Ext. apps',
    description: 'Aplicaciones web y APIs en superficie externa.',
  },
];

const APP_HINTS =
  /\b(app|aplicaci[oó]n|web|api|software|portal|sitio|url|http|https|dast|acunetix)\b/i;
const EQUIPO_HINTS =
  /\b(equipo|host|servidor|server|infra|dispositivo|red|network|firewall|switch|router|vm|nodo)\b/i;
const URL_RE = /^https?:\/\//i;

function meta(asset: SecopsAsset | null | undefined, key: string): string {
  return (asset?.metadata?.[key] ?? '').trim();
}

function exposureFromText(text: string): MatrixExposure | null {
  const t = text.toLowerCase();
  if (/\b(externa|external|p[uú]blica|public|internet|dmz)\b/.test(t)) return 'externa';
  if (/\b(interna|internal|privada|private|lan)\b/.test(t)) return 'interna';
  return null;
}

function exposureFromSourceType(sourceType?: string | null): MatrixExposure | null {
  if (!sourceType) return null;
  if (sourceType.startsWith('external_')) return 'externa';
  if (sourceType.startsWith('internal_')) return 'interna';
  return null;
}

export function classifyMatrixRow(
  finding: Finding,
  asset?: SecopsAsset | null
): { exposure: MatrixExposure; kind: MatrixAssetKind } {
  const componente = resolveFindingComponente(finding);
  const tool = normalizeToolSourceKey(finding.tool_source);

  let exposure: MatrixExposure | null =
    exposureFromText(meta(asset, 'exposicion')) ??
    exposureFromText(meta(asset, 'tipo_inventario')) ??
    exposureFromSourceType(asset?.source_type) ??
    null;

  if (!exposure && tool === 'acunetix') exposure = 'externa';
  if (!exposure && URL_RE.test(componente)) exposure = 'externa';
  if (!exposure && asset?.ip_publica && !asset?.ip_privada) exposure = 'externa';
  if (!exposure) exposure = 'interna';

  const typeBlob = [
    asset?.asset_type,
    meta(asset, 'tipo_recurso'),
    meta(asset, 'tipo_maquina'),
    meta(asset, 'tipo_infra'),
    componente,
    finding.titulo,
    tool,
  ]
    .filter(Boolean)
    .join(' ');

  let kind: MatrixAssetKind = 'equipo';
  if (tool === 'acunetix' || URL_RE.test(componente)) kind = 'app';
  else if (APP_HINTS.test(typeBlob) && !EQUIPO_HINTS.test(typeBlob)) kind = 'app';
  else if (EQUIPO_HINTS.test(typeBlob)) kind = 'equipo';
  else if (/\b(443|80|8080)\b/.test(componente) && /\/\w/.test(componente)) kind = 'app';

  return { exposure, kind };
}

export function rowMatchesMatrixView(
  finding: Finding,
  asset: SecopsAsset | null | undefined,
  viewId: VulnMatrixViewId
): boolean {
  if (viewId === 'completa') return true;
  const { exposure, kind } = classifyMatrixRow(finding, asset);
  switch (viewId) {
    case 'internas-equipos':
      return exposure === 'interna' && kind === 'equipo';
    case 'externas-equipos':
      return exposure === 'externa' && kind === 'equipo';
    case 'internas-apps':
      return exposure === 'interna' && kind === 'app';
    case 'externas-apps':
      return exposure === 'externa' && kind === 'app';
    default:
      return true;
  }
}

export function assetGroupKey(finding: Finding, asset?: SecopsAsset | null): string {
  if (asset?.id) return `asset:${asset.id}`;
  const comp = resolveFindingComponente(finding);
  if (comp) return `comp:${comp.toLowerCase()}`;
  return `finding:${finding.id}`;
}

export function assetGroupLabel(finding: Finding, asset?: SecopsAsset | null): string {
  if (asset?.nombre?.trim()) return asset.nombre.trim();
  const comp = resolveFindingComponente(finding);
  if (comp) return comp;
  return finding.titulo.slice(0, 80) || 'Sin activo';
}
