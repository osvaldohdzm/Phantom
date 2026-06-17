import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/** Hostnames allowed to load Next.js dev / RSC assets (Tailscale + LAN). */
export function collectDevOrigins(): string[] {
  const origins = new Set<string>(['localhost', '127.0.0.1']);

  for (const file of ['.env.local', '.env']) {
    try {
      const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const match = text.match(/^CERT_EXTRA_HOSTS=(.+)$/m);
      if (!match) continue;
      for (const host of match[1].split(/\s+/)) {
        const trimmed = host.trim().replace(/^['"]|['"]$/g, '');
        if (trimmed) origins.add(trimmed);
      }
    } catch {
      // optional env files
    }
  }

  const fromEnv = (process.env.DEV_ALLOWED_ORIGINS || '')
    .split(/[,\s]+/)
    .map((h) => h.trim())
    .filter(Boolean);
  for (const host of fromEnv) origins.add(host);

  try {
    const ts = execSync('tailscale ip -4 2>/dev/null || true', { encoding: 'utf8' }).trim();
    if (ts) origins.add(ts);
  } catch {
    // tailscale not installed
  }

  return [...origins];
}
