import type { SecopsAsset } from '@/lib/secops-api';

export type AssetTargetPort = {
  port: number;
  service?: string;
  protocol?: string;
};

export type AssetTargetHost = {
  key: string;
  ip: string;
  hostname: string;
  ports: AssetTargetPort[];
};

export type AssetTargetMapData = {
  hosts: AssetTargetHost[];
};

function parsePort(raw: string | undefined): number | null {
  const n = parseInt((raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 && n <= 65535 ? n : null;
}

export function buildAssetTargetMapData(
  assets: SecopsAsset[],
  scope: 'external' | 'internal'
): AssetTargetMapData {
  const buckets = new Map<string, AssetTargetHost>();

  for (const asset of assets) {
    const ip =
      scope === 'external'
        ? (asset.ip_publica || asset.fqdn || asset.nombre || '').trim()
        : (asset.ip_privada || asset.fqdn || asset.nombre || '').trim();
    if (!ip) continue;

    const key = ip.toLowerCase();
    const meta = asset.metadata ?? {};
    const hostname = (asset.fqdn || meta.hostname || meta.dns_reverso || '').trim();

    const bucket =
      buckets.get(key) ??
      ({
        key,
        ip,
        hostname,
        ports: [],
      } satisfies AssetTargetHost);

    if (!bucket.hostname && hostname) bucket.hostname = hostname;

    const portNum = parsePort(meta.puerto);
    if (portNum !== null) {
      const exists = bucket.ports.some((p) => p.port === portNum);
      if (!exists) {
        bucket.ports.push({
          port: portNum,
          service: meta.servicio?.trim() || undefined,
          protocol: meta.transporte?.trim() || undefined,
        });
      }
    }

    buckets.set(key, bucket);
  }

  const hosts = Array.from(buckets.values()).sort((a, b) => a.ip.localeCompare(b.ip));
  for (const h of hosts) {
    h.ports.sort((a, b) => a.port - b.port);
  }
  return { hosts };
}
