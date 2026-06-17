import type { Finding, SecopsAsset } from '@/lib/secops-api';
import type { NmapHost, NessusVuln } from '@/app/(secops)/tools/exposure/parsers';
import { parseNessus } from '@/app/(secops)/tools/exposure/parsers';

export type ExposureReportData = {
  hosts: NmapHost[];
  vulnerabilities: NessusVuln[];
};

export const EXPOSURE_MAP_CACHE_KEY = 'spectre.exposure-map.cache.v1';

export type ExposureMapCache = {
  engagementId?: string;
  title: string;
  savedAt: string;
  data: ExposureReportData;
};

const UNWANTED_VULNS = new Set([
  'SSL Certificate Cannot Be Trusted',
  'SSL Self-Signed Certificate',
]);

export function filterNessusVulns(vulns: NessusVuln[]): NessusVuln[] {
  const deadHosts = new Set(
    vulns
      .filter(
        (v) =>
          v.pluginId === '10180' && v.pluginOutput.toLowerCase().includes('considered as dead')
      )
      .map((v) => v.host)
  );
  return vulns.filter((v) => !deadHosts.has(v.host) && !UNWANTED_VULNS.has(v.name));
}

export function mergeExposureData(hosts: NmapHost[], vulns: NessusVuln[]): ExposureReportData {
  const hostMap = new Map<string, NmapHost>();
  for (const h of hosts) {
    if (!hostMap.has(h.ip)) {
      hostMap.set(h.ip, { ...h, ports: [...h.ports] });
    } else {
      const existing = hostMap.get(h.ip)!;
      const merged = [...existing.ports, ...h.ports];
      existing.ports = merged.filter(
        (v, i, a) => a.findIndex((t) => t.port === v.port && t.protocol === v.protocol) === i
      );
      if (!existing.hostname && h.hostname) existing.hostname = h.hostname;
      if (!existing.os && h.os) existing.os = h.os;
    }
  }

  const filtered = filterNessusVulns(vulns);
  for (const hostIp of new Set(filtered.map((v) => v.host))) {
    if (!hostMap.has(hostIp)) {
      hostMap.set(hostIp, { ip: hostIp, hostname: '', os: '', ports: [] });
    }
  }

  return { hosts: Array.from(hostMap.values()), vulnerabilities: filtered };
}

export async function buildExposureDataFromFiles(files: File[]): Promise<ExposureReportData> {
  const allHosts: NmapHost[] = [];
  let allVulns: NessusVuln[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'nessus') {
      allVulns.push(...(await parseNessus(file)));
    }
  }

  return mergeExposureData(allHosts, allVulns);
}

function hostFromText(text: string): string | null {
  const ipv4 = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  if (ipv4) return ipv4[0];
  const fqdn = text.match(/\b[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}\b/);
  return fqdn?.[0] ?? null;
}

export function buildExposureDataFromRepository(
  findings: Finding[],
  assets: SecopsAsset[]
): ExposureReportData {
  const hostMap = new Map<string, NmapHost>();

  for (const asset of assets) {
    const ip =
      asset.ip_publica?.trim() ||
      asset.ip_privada?.trim() ||
      hostFromText(asset.fqdn || '') ||
      hostFromText(asset.nombre || '');
    if (!ip) continue;
    hostMap.set(ip, {
      ip,
      hostname: asset.fqdn || asset.nombre || '',
      os: asset.os || '',
      ports: [],
    });
  }

  const vulns: NessusVuln[] = [];
  for (const f of findings) {
    const host =
      hostFromText(f.componente_afectado || '') ||
      hostFromText(f.titulo || '') ||
      'sin-host';
    if (!hostMap.has(host)) {
      hostMap.set(host, { ip: host, hostname: '', os: '', ports: [] });
    }
    vulns.push({
      pluginId: (f.cve || '').split(',')[0]?.trim() || '',
      cve: f.cve || '',
      cvss: f.cvss_score != null ? String(f.cvss_score) : '',
      risk: f.severidad || 'Info',
      host,
      protocol: 'tcp',
      port: 0,
      name: f.titulo || 'Hallazgo',
      synopsis: (f.descripcion || '').slice(0, 240),
      description: f.descripcion || '',
      solution: f.propuesta_remediacion || '',
      pluginOutput: f.componente_afectado || '',
    });
  }

  return mergeExposureData(Array.from(hostMap.values()), vulns);
}

export function saveExposureMapCache(cache: ExposureMapCache): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(EXPOSURE_MAP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

export function loadExposureMapCache(): ExposureMapCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(EXPOSURE_MAP_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExposureMapCache;
  } catch {
    return null;
  }
}

export async function appendNessusFileToCache(
  file: File,
  meta: { engagementId?: string; title?: string }
): Promise<ExposureMapCache> {
  const prev = loadExposureMapCache();
  const incoming = await buildExposureDataFromFiles([file]);
  const merged = prev?.data
    ? mergeExposureData(
        [...prev.data.hosts, ...incoming.hosts],
        [...prev.data.vulnerabilities, ...incoming.vulnerabilities]
      )
    : incoming;
  const cache: ExposureMapCache = {
    engagementId: meta.engagementId ?? prev?.engagementId,
    title: meta.title || file.name,
    savedAt: new Date().toISOString(),
    data: merged,
  };
  saveExposureMapCache(cache);
  return cache;
}
